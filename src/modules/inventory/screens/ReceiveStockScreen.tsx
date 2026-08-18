import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Plus,
  History,
  PackageCheck,
  ScanLine,
  Camera,
  Printer,
  Search,
  Trash2,
  AlertTriangle,
  Check,
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
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { productApi } from "@modules/product/api/productApi";
import { medguideApi } from "@modules/medguide/api/medguideApi";
import { CameraScanner } from "@shared/CameraScanner";
import { scanFeedback } from "@shared/scanFeedback";
import { QuickAddProduct } from "@modules/inventory/components/QuickAddProduct";
import { ProductPicker } from "@modules/inventory/components/ProductPicker";
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
import { LabelPrintSettings } from "@modules/inventory/components/LabelPrintSettings";
import {
  emptyLine,
  linesFromScan,
  productsFromScan,
  scanSummary,
  duplicateWarning,
  toReceiptLines,
  lineAmount,
  billTotals,
  totalBaseUnits,
} from "@modules/inventory/receiveDraft";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoneyExact, fmtAmountExact } from "@shared/format";
import { palette, radius, layout } from "@shared/designSystem";
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
  ChipsRow,
  Banner,
  DateField,
} from "@shared/ui";
import { useAuthStore } from "@shared/store/useAuthStore";

/** Stock expiring within this many days is flagged short at receiving. */
const SHORT_EXPIRY_DAYS = 90;
/** Marks a picker row that comes from the GLOBAL catalogue, not this store. */
const CATALOG_PREFIX = "catalog:";
/** Below this, a catalogue search matches too much to be worth the round trip. */
const CATALOG_MIN_CHARS = 2;
/** Sentinel for the row picker's last-resort "make one by hand" option. */
const CREATE_NEW = "__create_new__";

/** Parse a "YYYY-MM" or "YYYY-MM-DD" entry to the last date the lot is valid. */
function parseExpiry(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec((s || "").trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  if (mo < 1 || mo > 12) return null;
  // No day given → last day of that month (day 0 of the next month).
  return m[3] ? new Date(y, mo - 1, +m[3]) : new Date(y, mo, 0);
}

type ExpiryState = "ok" | "soon" | "expired";
/** How close to expiry a typed date is, and days remaining (negative = past). */
function expiryInfo(s: string): { state: ExpiryState; days: number } {
  const d = parseExpiry(s);
  if (!d) return { state: "ok", days: Infinity };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { state: "expired", days };
  return { state: days <= SHORT_EXPIRY_DAYS ? "soon" : "ok", days };
}

/**
 * Receive Stock — goods-received note, entered as a dense spreadsheet-style grid
 * laid out column-for-column like the distributor invoice it is keyed from:
 * Pack · Batch · Expiry · Qty · Free · MRP · Rate · Dis% · Gst% · Location ·
 * Amount, closing on the bill's own totals block. Draft rules and the invoice
 * arithmetic live in `receiveDraft.ts`.
 */
export default function ReceiveStockScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;

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
  /** Which row is currently picking its product inline (null = none). */
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const [rowQuery, setRowQuery] = useState("");
  // Whichever picker the pharmacist is actually typing in feeds the search.
  const activeQuery = pickingFor === null ? addQuery : rowQuery;
  // Debounce what the two searches actually receive. Typing "paracetamol" used
  // to fire 11 product searches AND 10 catalogue searches, whose replies could
  // land out of order — so the list you saw was whichever request happened to
  // finish last, not the one matching what you'd typed.
  useEffect(() => {
    const t = setTimeout(() => setProductQuery(activeQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [activeQuery]);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  /**
   * Which way the supplier charged GST. A Maharashtra pharmacy buying from a
   * Maharashtra distributor gets CGST+SGST; the same goods from out of state
   * arrive as a single IGST line. Every invoice reviewed prints one or the
   * other in its totals block, so the note has to be able to show either.
   */
  const [taxType, setTaxType] = useState<"intra" | "inter">("intra");
  // The whole receipt, not just its number — its lines carry the label codes
  // the "Print labels" step needs.
  const [done, setDone] = useState<ReceiptDetail | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  /** Supplier name read off a scanned bill that matched nothing in the master. */
  const [unmatchedSupplier, setUnmatchedSupplier] = useState<string | null>(
    null,
  );
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
    // The bill named a supplier we couldn't match. Hold the name and offer to
    // create it, rather than dropping it — the pharmacist would otherwise
    // retype a name that's sitting right there on the scanned page.
    else if (scanned.supplierName?.trim())
      setUnmatchedSupplier(scanned.supplierName.trim());
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

  /**
   * The global medicine catalogue (4 lakh+ medicines), searched alongside this
   * pharmacy's own products. A shop stocking an item for the first time
   * shouldn't have to retype name/pack/MRP/GST/HSN that the platform already
   * knows — picking a catalogue hit imports it in one tap (eVitalRx-style).
   */
  const catalogReady = productQuery.trim().length >= CATALOG_MIN_CHARS;
  const { data: catalogHits, isFetching: catalogLoading } = useQuery({
    queryKey: ["grn-catalog", productQuery],
    queryFn: () => medguideApi.search({ search: productQuery, limit: 8 }),
    enabled: catalogReady,
    // A given search over a 4-lakh-row catalogue doesn't change during a GRN.
    staleTime: 5 * 60 * 1000,
  });

  /**
   * True while any part of the answer is still coming — including the debounce
   * gap, when no request is in flight yet. Without that last term the dropdown
   * renders "No match" for the ~250ms between your last keystroke and the
   * request, which reads as "we don't stock it" and sends people off to create a
   * duplicate product. Silence is not a negative result.
   */
  const searching =
    productsLoading ||
    catalogLoading ||
    activeQuery.trim() !== productQuery.trim();

  // Keyboard-first "add a line" search — filling the first blank line, else
  // appending. Mirrors the POS add-bar so building a multi-line GRN is fast.
  const productItems = useMemo(() => {
    const mine = searchResults.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: p.sku,
    }));
    // Only offer catalogue entries this store doesn't already stock.
    const haveSku = new Set(searchResults.map((p) => p.sku));
    const fromCatalog = (catalogHits?.data || [])
      .filter((m) => !haveSku.has(m.sku))
      .map((m) => ({
        value: `${CATALOG_PREFIX}${m._id}`,
        label: m.name,
        sublabel: [m.saltComposition, m.manufacturerName]
          .filter(Boolean)
          .join(" · "),
        right: "+ Catalogue",
      }));
    return [...mine, ...fromCatalog];
  }, [searchResults, catalogHits]);

  /**
   * The row picker's list: everything the top bar offers, plus creating one by
   * hand as the LAST entry. Creating stays one tap away, but it is now the
   * fallback after searching rather than the thing the row does by default.
   */
  const pickerItems = useMemo(() => {
    if (!canManageProducts) return productItems;
    const typed = rowQuery.trim();
    return [
      ...productItems,
      {
        value: CREATE_NEW,
        label: typed
          ? `Create “${typed}” as a new product`
          : "Create new product",
        sublabel: "Not in your stock or the catalogue",
        right: "New",
      },
    ];
  }, [productItems, rowQuery, canManageProducts]);

  /**
   * Put a product on a line. `row` is the line that asked for it; null means
   * the top bar, which fills the first blank line or appends one.
   */
  const addLineForProduct = (id: string, row: number | null = null) => {
    const p = productsById[id];
    if (p) setKnownProducts((cur) => ({ ...cur, [p.id]: p }));
    const patch = { productId: id, unit: p?.baseUnit || null };
    if (row !== null) {
      setLines((cur) =>
        cur.map((l, k) => (k === row ? { ...l, ...patch } : l)),
      );
      return;
    }
    setLines((cur) => {
      const blank = cur.findIndex((l) => !l.productId);
      if (blank >= 0) {
        return cur.map((l, k) => (k === blank ? { ...l, ...patch } : l));
      }
      return [...cur, { ...emptyLine(), ...patch }];
    });
  };

  /**
   * Import a global-catalogue medicine into this store, then put it on a line.
   * Everything the catalogue knows (salt, brand, pack unit + factor, MRP, GST,
   * HSN, Rx flag) is copied server-side, so nothing has to be typed.
   */
  const addLineFromCatalog = async (
    catalogId: string,
    row: number | null = null,
  ) => {
    try {
      const created = await medguideApi.addToStore(catalogId);
      const full = await productApi.get(created.id);
      const lite: ProductLite = {
        id: full.id,
        name: full.name,
        sku: full.sku,
        baseUnit: full.baseUnit,
        packs: full.packs || [],
      };
      setKnownProducts((cur) => ({ ...cur, [lite.id]: lite }));
      const patch = { productId: lite.id, unit: lite.baseUnit };
      setLines((cur) => {
        if (row !== null)
          return cur.map((l, k) => (k === row ? { ...l, ...patch } : l));
        const blank = cur.findIndex((l) => !l.productId);
        if (blank >= 0)
          return cur.map((l, k) => (k === blank ? { ...l, ...patch } : l));
        return [...cur, { ...emptyLine(), ...patch }];
      });
      scanFeedback("ok");
      setScanNote(`Added ${lite.name} from the global catalogue.`);
    } catch (e) {
      scanFeedback("error");
      setScanNote(apiErrorMessage(e));
    }
  };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((cur) =>
      cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );

  // Camera scan → resolve the barcode to a product and add it as a GRN line.
  // Unknown barcodes aren't linked to any product yet, so we say so.
  const [scanOpen, setScanOpen] = useState(false);
  const handleCameraScan = async (code: string) => {
    setScanOpen(false);
    try {
      const res = await inventoryApi.scan(code);
      const sp = res.product;
      if (!sp) throw new Error("no match");
      const lite: ProductLite = {
        id: sp.id,
        name: sp.name,
        sku: sp.sku,
        baseUnit: sp.baseUnit,
        packs: sp.packs || [],
      };
      setKnownProducts((cur) => ({ ...cur, [lite.id]: lite }));
      addLineForProduct(lite.id);
      scanFeedback("ok");
      setScanNote(`Added ${sp.name} from its barcode.`);
    } catch {
      scanFeedback("error");
      setScanNote(
        `Barcode "${code}" isn't linked to a product yet. Search the product below and save this barcode on it (in Add/Edit product).`,
      );
    }
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

  const addLine = () => setLines((cur) => [...cur, emptyLine()]);

  const removeLine = (i: number) =>
    setLines((cur) =>
      cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i),
    );

  // The rate cell holds the rate for ONE of the line's packs — exactly what the
  // distributor printed — so the payable is qty × rate, with no pack arithmetic
  // in between. toReceiptLines divides by the pack factor on the way out, which
  // is where the server's per-base-unit purchasePrice comes from.
  const validLines = toReceiptLines(lines, productsById);
  const totalBase = totalBaseUnits(lines, productsById);
  const bill = billTotals(lines, taxType);
  const freeUnits = lines.reduce(
    (s, l) => s + (Number(l.freeQuantity) || 0),
    0,
  );

  // Short-expiry gate: warn on lots nearing expiry, block already-expired ones.
  const [confirmShort, setConfirmShort] = useState(false);
  const expFlags = lines.map((l) => expiryInfo(l.expiryDate));
  const expiredCount = lines.filter(
    (l, i) =>
      l.productId && l.expiryDate.trim() && expFlags[i].state === "expired",
  ).length;
  const soonLines = lines
    .map((l, i) => ({ l, i, ...expFlags[i] }))
    .filter(
      (x) => x.l.productId && x.l.expiryDate.trim() && x.state === "soon",
    );
  const soonest = soonLines.reduce((min, x) => Math.min(min, x.days), Infinity);
  const blockedByExpired = expiredCount > 0;
  const needsShortConfirm = soonLines.length > 0 && !confirmShort;

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
        copies: Math.max(1, Math.round(l.baseQuantity)),
      }));
    if (specs.length) void printLabels(specs, shopName);
  };

  const submit = () => {
    if (!validLines.length) return;
    mut.mutate(
      {
        supplierId,
        referenceNo: referenceNo.trim() || undefined,
        taxType,
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
            label="Camera"
            variant="secondary"
            fullWidth={false}
            icon={
              <Camera size={16} color={palette.text.primary} strokeWidth={2} />
            }
            onPress={() => setScanOpen(true)}
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
              <HStack gap={8} align="center" wrap>
                <LabelPrintSettings />
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
              </HStack>
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

      {/* Short-expiry gate: block expired outright, confirm near-expiry. */}
      {blockedByExpired ? (
        <Banner
          tone="danger"
          style={{ marginBottom: 16 }}
          message={`${expiredCount} line${
            expiredCount > 1 ? "s are" : " is"
          } already expired — expired stock can't be received. Fix the red expiry date${
            expiredCount > 1 ? "s" : ""
          } to continue.`}
        />
      ) : soonLines.length > 0 ? (
        <Banner tone="warning" style={{ marginBottom: 16 }}>
          <HStack gap={10} align="center" justify="space-between" wrap>
            <HStack gap={8} align="center" flex={1}>
              <AlertTriangle
                size={16}
                color={palette.warning.text}
                strokeWidth={2}
              />
              <Text variant="body-sm" tone="warning">
                {soonLines.length} line{soonLines.length > 1 ? "s" : ""}{" "}
                {soonLines.length > 1 ? "expire" : "expires"} within{" "}
                {SHORT_EXPIRY_DAYS} days
                {Number.isFinite(soonest) ? ` (soonest in ${soonest}d)` : ""} —
                check before you accept the stock.
              </Text>
            </HStack>
            <Pressable
              onPress={() => setConfirmShort((v) => !v)}
              style={styles.confirmToggle}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmShort }}
            >
              <View
                style={[
                  styles.checkbox,
                  confirmShort && {
                    backgroundColor: palette.warning.text,
                    borderColor: palette.warning.text,
                  },
                ]}
              >
                {confirmShort ? (
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                ) : null}
              </View>
              <Text variant="label-sm" tone="warning">
                Receive anyway
              </Text>
            </Pressable>
          </HStack>
        </Banner>
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
          {/* Deliberately a prompt, not an auto-create. OCR returns "SAFE LIFE
              ENTERPRISES PVT. LTD." one week and "SAFELIFE ENTERPRISES" the
              next; creating silently would quietly split one distributor's
              ledger across two supplier records. */}
          {unmatchedSupplier && !supplierId ? (
            <Banner
              tone="info"
              title={`"${unmatchedSupplier}" isn't in your suppliers yet`}
              message="Read from the scanned bill. Add it, or pick the right supplier above if you already have them under another name."
            >
              <HStack gap={10} wrap style={{ marginTop: 10 }}>
                {canManageSuppliers ? (
                  <Button
                    label="Add this supplier"
                    size="sm"
                    fullWidth={false}
                    loading={createSupplier.isPending}
                    onPress={async () => {
                      try {
                        const s = await createSupplier.mutateAsync({
                          name: unmatchedSupplier,
                        });
                        setSupplierId(s.id);
                        setUnmatchedSupplier(null);
                        setScanNote(`Supplier "${s.name}" added and selected.`);
                      } catch (e) {
                        setScanNote(apiErrorMessage(e));
                      }
                    }}
                  />
                ) : null}
                <Button
                  label="Not now"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setUnmatchedSupplier(null)}
                />
              </HStack>
            </Banner>
          ) : null}
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
          // Named for its job, so it doesn't read as a second way to do what the
          // row's own picker does: this one APPENDS lines, for working down a
          // bill without touching each row.
          placeholder="Add a line — search your stock or the catalogue"
          query={addQuery}
          onQueryChange={setAddQuery}
          items={productItems}
          loading={searching}
          onSelect={(id) => {
            if (id.startsWith(CATALOG_PREFIX)) {
              void addLineFromCatalog(id.slice(CATALOG_PREFIX.length));
            } else {
              addLineForProduct(id);
            }
            setAddQuery("");
          }}
          leading={
            <Search size={18} color={palette.teal[600]} strokeWidth={2} />
          }
          emptyText={
            addQuery.trim().length < CATALOG_MIN_CHARS
              ? `Type ${CATALOG_MIN_CHARS} letters to search your stock and the global catalogue`
              : "No match in your stock or the catalogue — add the line manually below"
          }
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
              {/* PACK, because that is the word on the paper. Across the 26
                  invoices reviewed it appears as PACK, PACKING or Pkg. — never
                  UNIT, which is what this column used to say. */}
              <GrnHead w={COL.pack} label="PACK" />
              <GrnHead w={COL.batch} label="BATCH" />
              <GrnHead w={COL.expiry} label="EXPIRY" />
              <GrnHead w={COL.qty} label="QTY" />
              <GrnHead w={COL.free} label="FREE" />
              <GrnHead w={COL.mrp} label="MRP" right />
              {/* RATE, and it means what the bill means by it: the price of one
                  PACK. It used to hold cost per BASE unit, so a bill printing a
                  trade price of 241.39 for a 15-cap pack showed 16.0927 — a
                  figure that appears nowhere on the paper. Same for MRP. */}
              <GrnHead w={COL.rate} label="RATE" right />
              <GrnHead w={COL.disc} label="DIS%" right />
              <GrnHead w={COL.gst} label="GST%" right />
              <GrnHead w={COL.loc} label="LOCATION" />
              <GrnHead w={COL.amount} label="AMOUNT" right />
              <View style={{ width: COL.rm }} />
            </View>
            {lines.map((line, i) => {
              const p = line.productId ? productsById[line.productId] : null;
              const qtyN = Number(line.quantity) || 0;
              const amount = lineAmount(line);
              const started = Boolean(line.productId);
              // Pack options read the way the bill writes them — "15 tablet",
              // not a bare unit name — so the cell can be matched against the
              // PACK column on the paper without doing arithmetic in your head.
              const units = p
                ? [
                    { value: p.baseUnit, label: `${p.baseUnit} (loose)` },
                    ...(p.packs || []).map((pk) => ({
                      value: pk.unit,
                      label: `${pk.factor} ${p.baseUnit}`,
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
                  {/* The product cell SEARCHES. It used to jump straight to
                      "New product", which skipped both your own stock and the
                      4-lakh catalogue — so the quickest way to fill a line was
                      to retype a medicine the system already knew, under a
                      slightly different spelling. That is how duplicates are
                      born. Creating one by hand is still there, as the last
                      option in the picker. */}
                  <View style={{ width: COL.product }}>
                    <Pressable
                      onPress={() => {
                        setPickingFor(i);
                        setRowQuery(p ? "" : line.fromBill?.productName || "");
                      }}
                      // The whole cell is the target, not just the text — this
                      // is the most-tapped control on the goods-received grid.
                      hitSlop={8}
                      style={{ minHeight: 34, justifyContent: "center" }}
                    >
                      <Text
                        variant="body-sm"
                        tone={p ? "primary" : "link"}
                        numberOfLines={1}
                      >
                        {p?.name ||
                          line.fromBill?.productName ||
                          "Set product…"}
                      </Text>
                    </Pressable>
                  </View>
                  {/* PACK. The select is what the maths runs on (it carries the
                      pack factor); the caption under it is the bill's own PACK
                      string, so the two can be read against each other without
                      going back to the paper. */}
                  <View style={{ width: COL.pack }}>
                    <Select
                      value={line.unit}
                      options={units}
                      onChange={(v) => setLine(i, { unit: v })}
                    />
                    {line.fromBill?.pack ? (
                      <Text
                        variant="caption"
                        tone="tertiary"
                        numberOfLines={1}
                        style={{ marginTop: 2 }}
                      >
                        Bill: {line.fromBill.pack}
                      </Text>
                    ) : null}
                  </View>
                  <GrnCell
                    w={COL.batch}
                    value={line.batchNumber}
                    onChangeText={(v) => setLine(i, { batchNumber: v })}
                    error={started && !line.batchNumber.trim()}
                  />
                  <DateField
                    compact
                    width={COL.expiry}
                    mode="month"
                    value={line.expiryDate}
                    onChange={(v) => setLine(i, { expiryDate: v })}
                    tone={
                      started && expFlags[i].state === "expired"
                        ? "error"
                        : started && expFlags[i].state === "soon"
                          ? "warn"
                          : "default"
                    }
                  />
                  <GrnCell
                    w={COL.qty}
                    value={line.quantity}
                    onChangeText={(v) => setLine(i, { quantity: v })}
                    numeric
                    align="center"
                    error={started && !(qtyN > 0)}
                  />
                  <GrnCell
                    w={COL.free}
                    value={line.freeQuantity}
                    onChangeText={(v) => setLine(i, { freeQuantity: v })}
                    numeric
                    align="center"
                    placeholder="0"
                  />
                  <GrnCell
                    w={COL.mrp}
                    value={line.mrp}
                    onChangeText={(v) => setLine(i, { mrp: v })}
                    numeric
                    align="right"
                  />
                  <GrnCell
                    w={COL.rate}
                    value={line.purchasePrice}
                    onChangeText={(v) => setLine(i, { purchasePrice: v })}
                    numeric
                    align="right"
                  />
                  <GrnCell
                    w={COL.disc}
                    value={line.discountPct}
                    onChangeText={(v) => setLine(i, { discountPct: v })}
                    numeric
                    align="right"
                    placeholder="0"
                  />
                  <GrnCell
                    w={COL.gst}
                    value={line.gstPct}
                    onChangeText={(v) => setLine(i, { gstPct: v })}
                    numeric
                    align="right"
                    placeholder="0"
                  />
                  <View style={{ width: COL.loc }}>
                    <Select
                      value={line.locationId}
                      options={locationOptions}
                      onChange={(v) => setLine(i, { locationId: v })}
                    />
                  </View>
                  {/* To the paisa. This column is read against the bill's own
                      AMOUNT column, and 2 × 64.46 is 128.92 there — showing
                      "₹129" here makes the two impossible to reconcile. */}
                  <Text
                    style={{ width: COL.amount, textAlign: "right" }}
                    variant="label-sm"
                    tone="primary"
                  >
                    {amount > 0 ? fmtAmountExact(amount) : "—"}
                  </Text>
                  <Pressable
                    onPress={() => lines.length > 1 && removeLine(i)}
                    // 30x15 before — under the 24px WCAG 2.2 floor, and a
                    // delete control is the worst one to have to aim at.
                    hitSlop={10}
                    style={{
                      width: COL.rm,
                      minHeight: 32,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
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

      <ProductPicker
        visible={pickingFor !== null}
        query={rowQuery}
        onQueryChange={setRowQuery}
        items={pickerItems}
        loading={searching}
        emptyText={
          rowQuery.trim().length < CATALOG_MIN_CHARS
            ? "Type 2 letters to search your stock and the catalogue"
            : "No match — choose “Create new product” below"
        }
        onSelect={(id) => {
          const row = pickingFor;
          if (row === null) return;
          if (id === CREATE_NEW) {
            requestCreateProduct(row, rowQuery.trim());
          } else if (id.startsWith(CATALOG_PREFIX)) {
            void addLineFromCatalog(id.slice(CATALOG_PREFIX.length), row);
          } else {
            addLineForProduct(id, row);
          }
          setPickingFor(null);
          setRowQuery("");
        }}
        onCancel={() => {
          setPickingFor(null);
          setRowQuery("");
        }}
      />

      <Pressable onPress={addLine} style={styles.addRow}>
        <Plus size={18} color={palette.teal[600]} strokeWidth={2.2} />
        <Text variant="label" tone="accent">
          Add another line
        </Text>
      </Pressable>

      {/* The foot of the bill, in the bill's own words and its own order:
          AMOUNT · DISC AMT · TAXABLE · CGST/SGST (or IGST) · TOTAL AMT ·
          Round Off · TO PAY. Every invoice reviewed prints this block, and
          prints the exact total AND the round-off separately — so a payment
          can be reconciled against either. */}
      <Card style={{ marginTop: 8, marginBottom: 16 }}>
        <HStack align="center" justify="space-between" wrap gap={12}>
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              Total to receive
            </Text>
            <Text variant="caption" tone="tertiary">
              {lines.filter((l) => l.productId).length} items · {totalBase} base
              units
              {freeUnits > 0 ? ` · ${freeUnits} free (scheme)` : ""}
            </Text>
            <HStack gap={6} align="center" style={{ marginTop: 6 }}>
              <Text variant="caption" tone="tertiary">
                GST
              </Text>
              <ChipsRow
                active={taxType}
                chips={[
                  { key: "intra", label: "Intra (CGST+SGST)" },
                  { key: "inter", label: "Inter (IGST)" },
                ]}
                onChange={(v) => setTaxType(v as "intra" | "inter")}
              />
            </HStack>
          </VStack>

          <VStack gap={3} style={{ minWidth: 240 }}>
            <TotalRow label="Amount" value={fmtAmountExact(bill.gross)} />
            {bill.discount > 0 ? (
              <TotalRow
                label="Disc amt"
                value={`−${fmtAmountExact(bill.discount)}`}
              />
            ) : null}
            <TotalRow label="Taxable" value={fmtAmountExact(bill.taxable)} />
            {taxType === "intra" ? (
              <>
                <TotalRow label="CGST" value={fmtAmountExact(bill.cgst)} />
                <TotalRow label="SGST" value={fmtAmountExact(bill.sgst)} />
              </>
            ) : (
              <TotalRow label="IGST" value={fmtAmountExact(bill.igst)} />
            )}
            <TotalRow label="Total amt" value={fmtAmountExact(bill.total)} />
            {bill.roundOff !== 0 ? (
              <TotalRow
                label="Round off"
                value={`${bill.roundOff > 0 ? "+" : "−"}${fmtAmountExact(Math.abs(bill.roundOff))}`}
              />
            ) : null}
            <View style={grn.totalRule} />
            {/* "To pay" is the figure AFTER the round-off, the way the bills
                print it (TOTAL AMT 572.34 · RoundOff −0.34 · TO PAY 572.00).
                The exact total is the "Total amt" row above — both are shown,
                because a supplier query is usually about the difference. */}
            <HStack align="center" justify="space-between">
              <Text variant="label-lg" tone="primary">
                To pay
              </Text>
              <Text variant="h3" tone="accent">
                {fmtMoneyExact(bill.payable)}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Card>

      {/* Right-aligned on desktop. A full-bleed 1,140px green bar across the
          bottom of a wide window is a phone pattern that followed us onto the
          counter PC; a commit button belongs at the end of the form it commits,
          at the size of the other controls. On a phone it still spans. */}
      <View
        style={{
          marginTop: 4,
          alignItems: wide ? "flex-end" : "stretch",
        }}
      >
        <Button
          label="Receive stock"
          size="lg"
          fullWidth={!wide}
          loading={mut.isPending}
          disabled={!validLines.length || blockedByExpired || needsShortConfirm}
          onPress={submit}
        />
      </View>

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

      <CameraScanner
        visible={scanOpen}
        title="Scan pack barcode"
        onDetected={handleCameraScan}
        onClose={() => setScanOpen(false)}
      />
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
  confirmToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.warning.text,
    backgroundColor: palette.surface.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ---- GRN spreadsheet grid ----
/**
 * The goods-received grid, column for column as a distributor invoice prints it.
 *
 * Taken from the 26 invoices in `All Bills` — Kayan, Safe Life, P. Vishram,
 * Jeevan Rekha, Shree Simba, Shree Pioneer, Healing, Dhanwantari, Kailash,
 * Rajawat, Mohar, Sagar, Mahalaxmi, Advik, Radiant, G&K, Jagnath, Yash, G.S.,
 * Hiren, Rajdeep, S.S. Every one of them carries this set, whatever it calls
 * them:  PACK · BATCH · EXP · QTY · FREE · MRP · RATE · DIS% · GST% · AMOUNT.
 *
 * Two deliberate departures from what was here before:
 *  - UNIT is now PACK. Not one bill says "unit"; they say PACK, PACKING or Pkg.
 *  - The MFG *date* column is gone. "MFG" on an invoice is the manufacturer
 *    (ABO, SUN, CIPL), never a manufacturing date — no bill prints one, and the
 *    column sat empty after every scan while costing 104px the GST columns need.
 */
/**
 * Widths are tuned so the whole row — AMOUNT included — fits a 1366/1440 laptop
 * without sideways scrolling. AMOUNT is the column being checked against the
 * paper; having it fall off the right edge defeats the point of the screen.
 */
const COL = {
  idx: 22,
  product: 166,
  pack: 84,
  batch: 84,
  expiry: 94,
  qty: 44,
  free: 40,
  // Money columns hold paise now ("1,759.63"), so they need the room.
  mrp: 74,
  rate: 74,
  disc: 48,
  gst: 46,
  loc: 104,
  amount: 88,
  rm: 26,
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
  warn,
}: {
  w: number;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
  align?: "left" | "center" | "right";
  placeholder?: string;
  error?: boolean;
  warn?: boolean;
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
          : warn
            ? {
                borderColor: palette.warning.text,
                backgroundColor: palette.warning.bg,
              }
            : null,
        // @ts-expect-error web-only outline reset
        { outlineStyle: "none" },
      ]}
    />
  );
}

/** One line of the totals block: label left, figure right-aligned. */
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack align="center" justify="space-between">
      <Text variant="body-sm" tone="secondary">
        {label}
      </Text>
      <Text variant="label-sm" tone="primary">
        {value}
      </Text>
    </HStack>
  );
}

const grn = StyleSheet.create({
  totalRule: {
    height: 1,
    backgroundColor: palette.border.default,
    marginVertical: 4,
  },
  // 6px, not 8: thirteen columns pay the gap twelve times, and the 26px that
  // buys is the difference between AMOUNT fitting on a 1366 laptop and not.
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.neutral[50],
    borderBottomWidth: 1.5,
    borderBottomColor: palette.border.strong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
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
