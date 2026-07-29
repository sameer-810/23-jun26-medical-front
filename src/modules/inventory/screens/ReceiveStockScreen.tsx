import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Plus,
  History,
  PackageCheck,
  ScanLine,
  Printer,
  Search,
  Trash2,
} from "lucide-react-native";
import {
  useProducts,
  useCreateProduct,
} from "@modules/product/hooks/useProducts";
import { useAllLocations } from "@modules/warehouse/hooks/useWarehouse";
import {
  useSuppliers,
  useCreateSupplier,
} from "@modules/supplier/hooks/useSuppliers";
import { useReceiveStock } from "@modules/inventory/hooks/useInventory";
import { QuickAddProduct } from "@modules/inventory/components/QuickAddProduct";
import {
  NewProductDraft,
  draftFromLine,
  toCreatePayload,
  toProductLite,
} from "@modules/inventory/productFromBill";
import {
  DraftLine,
  ProductLite,
  ReceiptDetail,
  ScannedBill,
} from "@modules/inventory/types";
import { printLabels, LabelSpec } from "@modules/inventory/label";
import {
  emptyLine,
  linesFromScan,
  productsFromScan,
  scanSummary,
  duplicateWarning,
  toReceiptLines,
  totalBaseUnits,
} from "@modules/inventory/receiveDraft";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoney } from "@shared/format";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
  Select,
  Combobox,
  Banner,
} from "@shared/ui";
import { useAuthStore } from "@shared/store/useAuthStore";

/**
 * Receive Stock — goods-received note, entered as a dense spreadsheet-style grid
 * (one row per medicine: Batch · Expiry · Qty · Unit · Rate · MRP · Location),
 * the way Marg / eVitalRx / GoFrugal do it. Draft rules live in `receiveDraft.ts`.
 */
export default function ReceiveStockScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // The catalogue can run to tens of thousands of items, so it's never loaded
  // whole: the picker searches server-side and `knownProducts` caches whatever
  // we've already resolved (scan matches + past picks).
  const [productQuery, setProductQuery] = useState("");
  const { data: products, isFetching: productsLoading } = useProducts({
    search: productQuery || undefined,
    limit: 50,
  });
  const { data: locations } = useAllLocations();
  const canManageSuppliers = useAuthStore((s) => s.hasPermission)(
    "suppliers.manage",
  );
  const canManageProducts = useAuthStore((s) => s.hasPermission)(
    "products.manage",
  );
  const shopName = useAuthStore((s) => s.organization?.name) || "Pharmacy";
  const { data: suppliers } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const createProduct = useCreateProduct();
  const mut = useReceiveStock();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [referenceNo, setReference] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  // The whole receipt, not just its number — its lines carry the label codes
  // the "Print labels" step needs.
  const [done, setDone] = useState<ReceiptDetail | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [knownProducts, setKnownProducts] = useState<
    Record<string, ProductLite>
  >({});
  /** Which line asked to create a product, and what it should open with. */
  const [creatingFor, setCreatingFor] = useState<{
    index: number;
    initial: NewProductDraft;
    fromBill: boolean;
  } | null>(null);

  // A scanned bill arrives as a route param — consume it once, then clear it so
  // a re-render can't wipe the pharmacist's edits.
  const scanned: ScannedBill | undefined = route.params?.scanned;
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot route param:
     the scan result only exists once navigation delivers it. */
  useEffect(() => {
    if (!scanned) return;
    setKnownProducts((cur) => ({ ...cur, ...productsFromScan(scanned) }));
    setLines(linesFromScan(scanned));
    setReference(scanned.invoiceNo || "");
    if (scanned.supplierMatch) setSupplierId(scanned.supplierMatch.id);
    setScanNote(scanSummary(scanned));
    setDupWarning(duplicateWarning(scanned));
    navigation.setParams({ scanned: undefined });
  }, [scanned, navigation]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const supplierOptions = (suppliers?.data || []).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const locationOptions = (locations || []).map((l) => ({
    value: l.id,
    label: `${l.code} — ${l.name}`,
  }));

  const searchResults = useMemo<ProductLite[]>(
    () =>
      (products?.data || []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        baseUnit: p.baseUnit,
        packs: p.packs || [],
      })),
    [products],
  );

  /** Cache first, topped up with the live results — resolves anything on the form. */
  const productsById = useMemo(() => {
    const map: Record<string, ProductLite> = { ...knownProducts };
    for (const p of searchResults) map[p.id] = p;
    return map;
  }, [searchResults, knownProducts]);

  // Keyboard-first "add a line" search — filling the first blank line, else
  // appending. Mirrors the POS add-bar so building a multi-line GRN is fast.
  const productItems = useMemo(
    () =>
      searchResults.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.sku,
      })),
    [searchResults],
  );
  const addLineForProduct = (id: string) => {
    const p = productsById[id];
    if (p) setKnownProducts((cur) => ({ ...cur, [p.id]: p }));
    setLines((cur) => {
      const blank = cur.findIndex((l) => !l.productId);
      if (blank >= 0) {
        return cur.map((l, k) =>
          k === blank ? { ...l, productId: id, unit: p?.baseUnit || null } : l,
        );
      }
      return [
        ...cur,
        { ...emptyLine(), productId: id, unit: p?.baseUnit || null },
      ];
    });
  };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((cur) =>
      cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );

  /**
   * The picker had nothing — open the create form for this line.
   *
   * `query` is whatever was typed, so a hand-added line still starts with a
   * name; a scanned line prefers the bill's own wording and pack.
   */
  const requestCreateProduct = (i: number, query: string) => {
    setCreatingFor({
      index: i,
      initial: draftFromLine(lines[i], query),
      fromBill: Boolean(lines[i].fromBill?.productName),
    });
  };

  /** Create it, then put it straight on the line that was missing it. */
  const saveNewProduct = (draft: NewProductDraft) => {
    if (!creatingFor) return;
    const { index } = creatingFor;
    createProduct.mutate(toCreatePayload(draft), {
      onSuccess: (created) => {
        const lite = toProductLite(created);
        setKnownProducts((cur) => ({ ...cur, [lite.id]: lite }));
        setLine(index, { productId: lite.id, unit: lite.baseUnit });
        setCreatingFor(null);
      },
    });
  };

  const addLine = () => setLines((cur) => [...cur, emptyLine()]);

  const removeLine = (i: number) =>
    setLines((cur) =>
      cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i),
    );

  const validLines = toReceiptLines(lines);
  const totalBase = totalBaseUnits(lines, productsById);
  const totalValue = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.purchasePrice) || 0),
    0,
  );

  /**
   * Print a shelf label for every unit just received. One label per unit is the
   * usual want — you sticker each strip/bottle as you shelve it — so copies
   * default to the received quantity; the label module caps a runaway total.
   */
  const printReceiptLabels = (receipt: ReceiptDetail) => {
    const specs: LabelSpec[] = receipt.lines
      .filter((l) => l.labelCode)
      .map((l) => ({
        labelCode: l.labelCode!,
        productName: l.productName,
        batchNumber: l.batchNumber,
        expiry: l.expiryDate,
        mrp: l.mrp,
        copies: Math.max(1, Math.round(l.quantity)),
      }));
    if (specs.length) void printLabels(specs, shopName);
  };

  const submit = () => {
    if (!validLines.length) return;
    mut.mutate(
      {
        supplierId,
        referenceNo: referenceNo.trim() || undefined,
        lines: validLines,
      },
      {
        onSuccess: (r) => {
          setDone(r);
          setLines([emptyLine()]);
          setSupplierId(null);
          setReference("");
          setScanNote(null);
          setDupWarning(null);
        },
      },
    );
  };

  return (
    <Screen
      overline="Stock Inward"
      title="Receive stock"
      subtitle="Goods received note — batch, expiry, location & cost"
      right={
        <HStack gap={8}>
          <Button
            label="Scan bill"
            fullWidth={false}
            icon={<ScanLine size={16} color="#FFFFFF" strokeWidth={2} />}
            onPress={() => navigation.navigate("ScanBill")}
          />
          <Button
            label="History"
            variant="secondary"
            fullWidth={false}
            icon={
              <History size={16} color={palette.text.primary} strokeWidth={2} />
            }
            onPress={() => navigation.navigate("Receipts")}
          />
        </HStack>
      }
    >
      {dupWarning ? (
        <Banner
          tone="warning"
          message={dupWarning}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {scanNote ? (
        <Banner tone="info" message={scanNote} style={{ marginBottom: 16 }} />
      ) : null}
      {done ? (
        <Banner tone="success" style={{ marginBottom: 16 }}>
          <HStack gap={10} align="center" justify="space-between" wrap>
            <HStack gap={8} align="center" flex={1}>
              <PackageCheck
                size={16}
                color={palette.success.text}
                strokeWidth={2}
              />
              <Text variant="body-sm" tone="success">
                Stock received — {done.receiptNo} posted to inventory.
              </Text>
            </HStack>
            {done.lines.some((l) => l.labelCode) && (
              <Button
                label="Print labels"
                variant="secondary"
                fullWidth={false}
                onPress={() => printReceiptLabels(done)}
                icon={
                  <Printer
                    size={15}
                    color={palette.text.primary}
                    strokeWidth={2}
                  />
                }
              />
            )}
          </HStack>
        </Banner>
      ) : null}
      {mut.isError ? (
        <Banner
          tone="danger"
          message={apiErrorMessage(mut.error)}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <Select
            label="Supplier (optional)"
            placeholder="Select supplier"
            value={supplierId}
            options={supplierOptions}
            onChange={setSupplierId}
            onCreate={
              canManageSuppliers
                ? async (label) => {
                    const s = await createSupplier.mutateAsync({ name: label });
                    return { value: s.id, label: s.name };
                  }
                : undefined
            }
            allowClear
          />
          <TextField
            label="Reference / PO no."
            value={referenceNo}
            onChangeText={setReference}
            placeholder="PO-1234"
          />
        </VStack>
      </Card>

      <View style={{ marginBottom: 12, zIndex: 20 }}>
        <Combobox
          placeholder="Search a medicine to add a line — or use Scan bill above"
          query={addQuery}
          onQueryChange={(t) => {
            setAddQuery(t);
            setProductQuery(t);
          }}
          items={productItems}
          loading={productsLoading}
          onSelect={(id) => {
            addLineForProduct(id);
            setAddQuery("");
          }}
          leading={
            <Search size={18} color={palette.teal[600]} strokeWidth={2} />
          }
          emptyText="No match — type the full name, or add the line manually below"
        />
      </View>

      <Card padded={false} style={{ overflow: "hidden", marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: "100%" }}
        >
          <View style={{ minWidth: "100%" }}>
            <View style={grn.head}>
              <GrnHead w={COL.idx} label="#" />
              <GrnHead w={COL.product} label="PRODUCT" left />
              <GrnHead w={COL.batch} label="BATCH" />
              <GrnHead w={COL.mfg} label="MFG" />
              <GrnHead w={COL.expiry} label="EXPIRY" />
              <GrnHead w={COL.qty} label="QTY" />
              <GrnHead w={COL.unit} label="UNIT" />
              <GrnHead w={COL.rate} label="RATE" right />
              <GrnHead w={COL.mrp} label="MRP" right />
              <GrnHead w={COL.loc} label="LOCATION" />
              <GrnHead w={COL.amount} label="AMOUNT" right />
              <View style={{ width: COL.rm }} />
            </View>
            {lines.map((line, i) => {
              const p = line.productId ? productsById[line.productId] : null;
              const qtyN = Number(line.quantity) || 0;
              const rateN = Number(line.purchasePrice) || 0;
              const amount = qtyN * rateN;
              const started = Boolean(line.productId);
              const units = p
                ? [
                    { value: p.baseUnit, label: p.baseUnit },
                    ...(p.packs || []).map((pk) => ({
                      value: pk.unit,
                      label: pk.unit,
                    })),
                  ]
                : line.unit
                  ? [{ value: line.unit, label: line.unit }]
                  : [];
              return (
                <View
                  key={i}
                  style={[
                    grn.row,
                    i % 2 === 1 ? { backgroundColor: palette.ink[50] } : null,
                  ]}
                >
                  <Text
                    style={{ width: COL.idx, textAlign: "center" }}
                    variant="caption"
                    tone="tertiary"
                  >
                    {i + 1}
                  </Text>
                  <View style={{ width: COL.product }}>
                    {p ? (
                      <Text variant="body-sm" tone="primary" numberOfLines={1}>
                        {p.name}
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() =>
                          canManageProducts &&
                          requestCreateProduct(
                            i,
                            line.fromBill?.productName || "",
                          )
                        }
                      >
                        <Text variant="body-sm" tone="link" numberOfLines={1}>
                          {line.fromBill?.productName || "Set product…"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <GrnCell
                    w={COL.batch}
                    value={line.batchNumber}
                    onChangeText={(v) => setLine(i, { batchNumber: v })}
                    error={started && !line.batchNumber.trim()}
                  />
                  <GrnCell
                    w={COL.mfg}
                    value={line.mfgDate}
                    onChangeText={(v) => setLine(i, { mfgDate: v })}
                    placeholder="YYYY-MM"
                  />
                  <GrnCell
                    w={COL.expiry}
                    value={line.expiryDate}
                    onChangeText={(v) => setLine(i, { expiryDate: v })}
                    placeholder="YYYY-MM"
                  />
                  <GrnCell
                    w={COL.qty}
                    value={line.quantity}
                    onChangeText={(v) => setLine(i, { quantity: v })}
                    numeric
                    align="center"
                    error={started && !(qtyN > 0)}
                  />
                  <View style={{ width: COL.unit }}>
                    <Select
                      value={line.unit}
                      options={units}
                      onChange={(v) => setLine(i, { unit: v })}
                    />
                  </View>
                  <GrnCell
                    w={COL.rate}
                    value={line.purchasePrice}
                    onChangeText={(v) => setLine(i, { purchasePrice: v })}
                    numeric
                    align="right"
                  />
                  <GrnCell
                    w={COL.mrp}
                    value={line.mrp}
                    onChangeText={(v) => setLine(i, { mrp: v })}
                    numeric
                    align="right"
                  />
                  <View style={{ width: COL.loc }}>
                    <Select
                      value={line.locationId}
                      options={locationOptions}
                      onChange={(v) => setLine(i, { locationId: v })}
                    />
                  </View>
                  <Text
                    style={{ width: COL.amount, textAlign: "right" }}
                    variant="label-sm"
                    tone="primary"
                  >
                    {amount > 0 ? fmtMoney(amount) : "—"}
                  </Text>
                  <Pressable
                    onPress={() => lines.length > 1 && removeLine(i)}
                    style={{ width: COL.rm, alignItems: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove line"
                  >
                    <Trash2
                      size={15}
                      color={palette.text.tertiary}
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      <Pressable onPress={addLine} style={styles.addRow}>
        <Plus size={18} color={palette.teal[600]} strokeWidth={2.2} />
        <Text variant="label" tone="accent">
          Add another line
        </Text>
      </Pressable>

      <Card style={{ marginTop: 8, marginBottom: 16 }}>
        <HStack align="center" justify="space-between">
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              Total to receive
            </Text>
            <Text variant="caption" tone="tertiary">
              {totalBase} base units
            </Text>
          </VStack>
          <VStack gap={2} align="flex-end">
            <Text variant="caption" tone="tertiary">
              Purchase value
            </Text>
            <Text variant="h3" tone="accent">
              {fmtMoney(totalValue)}
            </Text>
          </VStack>
        </HStack>
      </Card>

      <Button
        label="Receive stock"
        size="lg"
        loading={mut.isPending}
        disabled={!validLines.length}
        onPress={submit}
      />

      {/* Keyed by line so each open starts from that line's bill data. */}
      {creatingFor && (
        <QuickAddProduct
          key={creatingFor.index}
          visible
          initial={creatingFor.initial}
          fromBill={creatingFor.fromBill}
          saving={createProduct.isPending}
          error={
            createProduct.isError ? apiErrorMessage(createProduct.error) : null
          }
          onCancel={() => {
            createProduct.reset();
            setCreatingFor(null);
          }}
          onSave={saveNewProduct}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    justifyContent: "center",
  },
});

// ---- GRN spreadsheet grid ----
const COL = {
  idx: 26,
  product: 190,
  batch: 88,
  mfg: 82,
  expiry: 82,
  qty: 52,
  unit: 90,
  rate: 76,
  mrp: 76,
  loc: 132,
  amount: 82,
  rm: 30,
};

function GrnHead({
  w,
  label,
  left,
  right,
}: {
  w: number;
  label: string;
  left?: boolean;
  right?: boolean;
}) {
  return (
    <Text
      style={{
        width: w,
        textAlign: left ? "left" : right ? "right" : "center",
      }}
      variant="overline"
      tone="tertiary"
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

function GrnCell({
  w,
  value,
  onChangeText,
  numeric,
  align = "left",
  placeholder,
  error,
}: {
  w: number;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
  align?: "left" | "center" | "right";
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={numeric ? "decimal-pad" : "default"}
      placeholder={placeholder}
      placeholderTextColor={palette.text.tertiary}
      selectTextOnFocus
      style={[
        grn.cell,
        { width: w, textAlign: align },
        error
          ? {
              borderColor: palette.danger.text,
              backgroundColor: palette.danger.bg,
            }
          : null,
        // @ts-expect-error web-only outline reset
        { outlineStyle: "none" },
      ]}
    />
  );
}

const grn = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.neutral[50],
    borderBottomWidth: 1.5,
    borderBottomColor: palette.border.strong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  cell: {
    height: 38,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    fontSize: 13,
    color: palette.text.primary,
    backgroundColor: palette.surface.primary,
  },
});
