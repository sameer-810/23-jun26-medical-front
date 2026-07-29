import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Plus,
  History,
  PackageCheck,
  ScanLine,
  Printer,
  Search,
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
import { ReceiveLineRow } from "@modules/inventory/components/ReceiveLineRow";
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
import { palette } from "@shared/designSystem";
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
 * Receive Stock — goods-received note.
 *
 * Orchestration only: state, data fetching and wiring. The draft rules live in
 * `receiveDraft.ts` and a line's UI in `components/ReceiveLineRow`.
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
  /** Open rows. Collapsed by default so a 25-line bill fits on one screen. */
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  /** Which line asked to create a product, and what it should open with. */
  const [creatingFor, setCreatingFor] = useState<{
    index: number;
    initial: NewProductDraft;
    fromBill: boolean;
  } | null>(null);

  const toggleExpanded = (i: number) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // A scanned bill arrives as a route param — consume it once, then clear it so
  // a re-render can't wipe the pharmacist's edits.
  const scanned: ScannedBill | undefined = route.params?.scanned;
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot route param:
     the scan result only exists once navigation delivers it. */
  useEffect(() => {
    if (!scanned) return;
    setKnownProducts((cur) => ({ ...cur, ...productsFromScan(scanned) }));
    setLines(linesFromScan(scanned));
    setExpanded(new Set()); // all collapsed — the point is to see them all
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

  /** The picker lists search results only — the catalogue is far too big to list. */
  const productOptions = useMemo(
    () =>
      searchResults.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.sku}`,
      })),
    [searchResults],
  );

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
        setExpanded((e) => new Set(e).add(blank));
        return cur.map((l, k) =>
          k === blank ? { ...l, productId: id, unit: p?.baseUnit || null } : l,
        );
      }
      setExpanded((e) => new Set(e).add(cur.length));
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

  /** Remember every pick so its name/unit survives the next search. */
  const pickProduct = (i: number, id: string | null) => {
    const p = id ? productsById[id] : null;
    if (p) setKnownProducts((cur) => ({ ...cur, [p.id]: p }));
    setLine(i, { productId: id, unit: p?.baseUnit || null });
  };

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

  // A manually-added line is the one you want to fill in next.
  const addLine = () =>
    setLines((cur) => {
      setExpanded((e) => new Set(e).add(cur.length));
      return [...cur, emptyLine()];
    });

  const removeLine = (i: number) =>
    setLines((cur) =>
      cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i),
    );

  const validLines = toReceiptLines(lines);
  const totalBase = totalBaseUnits(lines, productsById);

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
          setExpanded(new Set([0]));
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

      <VStack gap={10}>
        {lines.map((line, i) => (
          <ReceiveLineRow
            key={i}
            index={i}
            line={line}
            product={line.productId ? productsById[line.productId] : null}
            open={expanded.has(i)}
            onToggle={() => toggleExpanded(i)}
            onChange={(patch) => setLine(i, patch)}
            onPickProduct={(id) => pickProduct(i, id)}
            onRemove={lines.length > 1 ? () => removeLine(i) : undefined}
            productOptions={productOptions}
            onSearchProducts={setProductQuery}
            productsLoading={productsLoading}
            locationOptions={locationOptions}
            onRequestCreateProduct={
              canManageProducts ? (q) => requestCreateProduct(i, q) : undefined
            }
          />
        ))}
      </VStack>

      <Pressable onPress={addLine} style={styles.addRow}>
        <Plus size={18} color={palette.teal[600]} strokeWidth={2.2} />
        <Text variant="label" tone="accent">
          Add another line
        </Text>
      </Pressable>

      <Card style={{ marginTop: 8, marginBottom: 16 }}>
        <HStack align="center" justify="space-between">
          <Text variant="label-lg" tone="primary">
            Total to receive
          </Text>
          <Text variant="h3" tone="accent">
            {totalBase} units
          </Text>
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
