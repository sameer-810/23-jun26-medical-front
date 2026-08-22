import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useProducts } from "@modules/product/hooks/useProducts";
import { useProductInventory } from "@modules/inventory/hooks/useInventory";
import { VStack, HStack, Select, Text } from "@shared/ui";
import { fmtDate } from "@shared/format";

export interface CellSelection {
  productId: string | null;
  batchId: string | null;
  locationId: string | null;
  available: number;
  baseUnit: string;
  batchNumber: string;
  locationCode: string;
}

interface Props {
  value: CellSelection;
  onChange: (sel: CellSelection) => void;
  locationLabel?: string;
  /** When true, lay the product/batch/location Selects on a single wrapping row. */
  row?: boolean;
}

const fieldWrap = { flexGrow: 1, flexBasis: 200, minWidth: 160 } as const;

const EMPTY: Omit<CellSelection, "productId"> = {
  batchId: null,
  locationId: null,
  available: 0,
  baseUnit: "",
  batchNumber: "",
  locationCode: "",
};

/** Picks an exact in-stock cell: product → batch → location (with availability). */
export function StockCellPicker({
  value,
  onChange,
  locationLabel = "Location",
  row = false,
}: Props) {
  // The catalogue is paged, so the picker searches server-side rather than
  // listing whatever happened to be on page 1.
  const [productQuery, setProductQuery] = useState("");
  const { data: products, isFetching: productsLoading } = useProducts({
    search: productQuery || undefined,
    limit: 50,
  });
  const { data: inv } = useProductInventory(value.productId || "");

  const productOptions = (products?.data || []).map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.sku}`,
  }));
  // The chosen product is resolved by its own inventory query, so it keeps its
  // label even when the search results no longer contain it.
  const selectedProductLabel = inv?.product
    ? `${inv.product.name} · ${inv.product.sku}`
    : undefined;
  const baseUnit = inv?.product.baseUnit || "";
  const batches = inv?.batches || [];
  const batchOptions = batches.map((b) => ({
    value: b.batchId,
    label: `${b.batchNumber}${b.expiryDate ? ` · exp ${fmtDate(b.expiryDate)}` : ""} · ${b.onHand} ${baseUnit}`,
  }));
  const selectedBatch = batches.find((b) => b.batchId === value.batchId);
  const locationOptions = (selectedBatch?.locations || []).map((l) => ({
    value: l.locationId,
    label: `${l.code} · ${l.quantity} ${baseUnit}`,
  }));
  const selectedLoc = selectedBatch?.locations.find(
    (l) => l.locationId === value.locationId,
  );

  // Keep derived fields (available/baseUnit/labels) in sync with the selection.
  useEffect(() => {
    const available = selectedLoc?.quantity ?? 0;
    if (
      value.available !== available ||
      value.baseUnit !== baseUnit ||
      value.batchNumber !== (selectedBatch?.batchNumber || "") ||
      value.locationCode !== (selectedLoc?.code || "")
    ) {
      onChange({
        ...value,
        available,
        baseUnit,
        batchNumber: selectedBatch?.batchNumber || "",
        locationCode: selectedLoc?.code || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    value.productId,
    value.batchId,
    value.locationId,
    baseUnit,
    selectedBatch,
    selectedLoc,
  ]);

  const productSelect = (
    <Select
      label="Product"
      placeholder="Search by name or SKU…"
      value={value.productId}
      options={productOptions}
      selectedLabel={selectedProductLabel}
      onSearch={setProductQuery}
      loading={productsLoading}
      onChange={(v) => onChange({ productId: v, ...EMPTY })}
    />
  );
  const batchSelect = (
    <Select
      label="Batch"
      placeholder={value.productId ? "Select batch" : "Pick a product first"}
      value={value.batchId}
      options={batchOptions}
      onChange={(v) => onChange({ ...value, batchId: v, locationId: null })}
    />
  );
  const locationSelect = (
    <Select
      label={locationLabel}
      placeholder={value.batchId ? "Select location" : "Pick a batch first"}
      value={value.locationId}
      options={locationOptions}
      onChange={(v) => onChange({ ...value, locationId: v })}
    />
  );
  const availabilityNote = value.locationId ? (
    <Text variant="caption" tone="tertiary">
      Available here: {value.available} {value.baseUnit}
    </Text>
  ) : null;

  return (
    <VStack gap={row ? 12 : 16}>
      {row ? (
        <HStack gap={12} wrap>
          <View style={fieldWrap}>{productSelect}</View>
          <View style={fieldWrap}>{batchSelect}</View>
          <View style={fieldWrap}>{locationSelect}</View>
        </HStack>
      ) : (
        <>
          {productSelect}
          {batchSelect}
          {locationSelect}
        </>
      )}
      {availabilityNote}
    </VStack>
  );
}

export const emptyCell = (): CellSelection => ({
  productId: null,
  batchId: null,
  locationId: null,
  available: 0,
  baseUnit: "",
  batchNumber: "",
  locationCode: "",
});
