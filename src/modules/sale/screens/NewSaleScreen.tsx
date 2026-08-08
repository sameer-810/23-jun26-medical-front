import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  ShoppingCart,
  ScanLine,
  Search,
  Trash2,
  PackageX,
  Repeat,
  X,
  CheckCircle2,
  Camera,
  ScanText,
  Volume2,
  VolumeX,
  ListPlus,
} from "lucide-react-native";
import { CameraScanner } from "@shared/CameraScanner";
import { PackTextScanner } from "@shared/PackTextScanner";
import {
  scanFeedback,
  setScanSoundMuted,
  isScanSoundMuted,
} from "@shared/scanFeedback";
import { useProducts } from "@modules/product/hooks/useProducts";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { AlternativeItem } from "@modules/inventory/types";
import { useScanGun } from "@shared/useScanGun";
import {
  useCustomers,
  useCreateCustomer,
} from "@modules/customer/hooks/useCustomers";
import { useCreateSale, useInvoiceProfile } from "@modules/sale/hooks/useSales";
import { useCreateReminder } from "@modules/reminder/hooks/useReminders";
import { SaleLineInput } from "@modules/sale/types";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  Select,
  ChipsRow,
  Combobox,
  Banner,
  EmptyState,
  ConfirmDialog,
} from "@shared/ui";

interface DraftLine {
  productId: string;
  productName: string;
  salt?: string | null;
  baseUnit: string;
  /** Set when the line came from a scanned label — pins the sale to this lot. */
  batchId?: string | null;
  batchNumber?: string | null;
  expiry?: string | null;
  /** Sellable BASE units behind this line (scanned lot's stock, or product total). */
  available?: number | null;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  discountMode: "amount" | "pct";
  taxRate: string;
}

/** "2028-01-31" / ISO -> "Jan 28" for a compact expiry read on a line. */
const prettyExp = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m] = String(iso).slice(0, 10).split("-");
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${months[Number(m) - 1] || m} ${String(y).slice(2)}`;
};
const money = (n: number) =>
  `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;

export default function NewSaleScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  /**
   * Only use the column grid when the medicine name actually has room.
   *
   * At `wide` the row competes with the sidebar (240), page padding (48) and
   * the 344px totals rail, leaving `width - 648` for the table — and the fixed
   * columns take 552 of that. At the old 1200 threshold the name column was
   * computed at MINUS 36px, so the product name, its salt line and the FEFO
   * badge piled on top of the quantity box. It only became legible around
   * 1440, which is the width this was checked at — one step past the damage,
   * while 1366 (the commonest laptop here) sat squarely inside it.
   *
   * 1400 is the first width that leaves the name ~200px.
   *
   * Two separate questions, deliberately split. Whether the TOTALS sit beside
   * the cart is about page shape; whether the LINE ITEMS use a column grid is
   * about how much room the medicine name has. Tying both to one flag meant
   * fixing the cramped row would also push "Grand total" and "Complete sale"
   * below the fold on a 1366 counter PC — trading a layout bug for a slower
   * sale.
   */
  const railSide = width >= 1200;
  const wide = width >= 1400;

  // What's typed vs what's actually searched. The counter search is the busiest
  // input in the product — undebounced it fired one request per keystroke, and
  // replies could land out of order, so the list you saw was whichever response
  // happened to return last rather than the one matching what you'd typed.
  const [productQuery, setProductQuery] = useState("");
  const [productTerm, setProductTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setProductTerm(productQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [productQuery]);
  const { data: products, isFetching: productsFetching } = useProducts({
    search: productTerm || undefined,
    limit: 50,
  });
  // The debounce gap still counts as searching, or the dropdown flashes
  // "no medicine matches" between the last keystroke and the request.
  const productsLoading =
    productsFetching || productQuery.trim() !== productTerm;

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerTerm, setCustomerTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setCustomerTerm(customerQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [customerQuery]);
  const { data: customers, isFetching: customersFetching } = useCustomers({
    search: customerTerm || undefined,
  });
  const customersLoading =
    customersFetching || customerQuery.trim() !== customerTerm;
  const createCustomer = useCreateCustomer();
  const mut = useCreateSale();
  const { data: invoiceProfile } = useInvoiceProfile();
  const priceIncludesTax = invoiceProfile?.tax?.priceIncludesTax ?? false;

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [taxType, setTaxType] = useState<"intra" | "inter">("intra");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  /**
   * Opened straight from the phone's scan button, so the camera is already up
   * by the time the screen paints — the whole point of that button is to skip
   * a tap, and landing on a screen that then needs one gives it back.
   */
  const route = useRoute();
  const autoScan = Boolean(
    (route.params as { autoScan?: boolean } | undefined)?.autoScan,
  );
  const [scanOpen, setScanOpen] = useState(autoScan);
  const [soundOff, setSoundOff] = useState(isScanSoundMuted());
  /** Camera OCR for packs whose batch number is printed as text, not a barcode. */
  const [packOpen, setPackOpen] = useState(false);
  /** Refill follow-up offered right after a sale completes. */
  const [followUp, setFollowUp] = useState<{
    saleId: string;
    days: number;
    customerName: string;
    medicine: string;
  } | null>(null);
  const createReminder = useCreateReminder();
  const scanBusy = useRef(false);
  type ProductRow = NonNullable<typeof products>["data"][number];
  type CustomerRow = NonNullable<typeof customers>["data"][number];
  const [knownProducts, setKnownProducts] = useState<
    Record<string, ProductRow>
  >({});
  const [knownCustomers, setKnownCustomers] = useState<
    Record<string, CustomerRow>
  >({});

  /** Cache + live results — what the pricing maths reads from. */
  const productsById = useMemo(() => {
    const map: Record<string, ProductRow> = { ...knownProducts };
    for (const p of products?.data || []) map[p.id] = p;
    return map;
  }, [products, knownProducts]);

  const productItems = (products?.data || []).map((p) => ({
    value: p.id,
    label: p.name,
    sublabel: p.saltComposition || p.sku,
    right: `${money(p.sellingPrice)}/${p.baseUnit}`,
  }));
  const customerOptions = (customers?.data || []).map((c) => ({
    value: c.id,
    label: c.mobile ? `${c.name} · ${c.mobile}` : c.name,
  }));
  const selectedCustomer = customerId
    ? knownCustomers[customerId] ||
      (customers?.data || []).find((c) => c.id === customerId)
    : null;

  const pickCustomer = (id: string | null) => {
    const c = id ? (customers?.data || []).find((x) => x.id === id) : null;
    if (c) setKnownCustomers((cur) => ({ ...cur, [c.id]: c }));
    setCustomerId(id);
  };

  const unitOptions = (line: DraftLine) => {
    const p = productsById[line.productId];
    if (!p) return [{ value: line.baseUnit, label: line.baseUnit }];
    return [
      { value: p.baseUnit, label: `${p.baseUnit} (base)` },
      ...(p.packs || []).map((pk) => ({
        value: pk.unit,
        label: `${pk.unit} (×${pk.factor})`,
      })),
    ];
  };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((cur) =>
      cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );

  /** Price for a product in a given unit = base price × that unit's pack factor. */
  const priceForUnit = (productId: string, unit: string | null) => {
    const p = productsById[productId];
    if (!p) return "";
    const factor =
      !unit || unit === p.baseUnit
        ? 1
        : (p.packs || []).find((x) => x.unit === unit)?.factor || 1;
    return String(Math.round((p.sellingPrice || 0) * factor * 100) / 100);
  };
  const removeLine = (i: number) =>
    setLines((cur) => cur.filter((_, idx) => idx !== i));

  /**
   * Note a medicine that couldn't be sold, from the till.
   *
   * This is where a short is actually discovered: the customer is standing
   * there, the line says "Out of stock", and the choice is a substitute or a
   * note to buy it. Sending them to MedGuide to search the same medicine a
   * second time is how a short becomes a lost sale nobody records.
   *
   * The quantity sent is the SHORTFALL, not 1 — someone asking for 20 and
   * getting 6 is a different reorder signal from someone asking for one.
   * ShortBook only ever raises an existing reorder level, never lowers it.
   */
  const [shortbookBusy, setShortbookBusy] = useState<string | null>(null);
  const [shortbookNote, setShortbookNote] = useState<string | null>(null);
  const addToShortbook = async (line: DraftLine, need: number) => {
    setShortbookBusy(line.productId);
    setShortbookNote(null);
    try {
      const r = await inventoryApi.addToShortbook({
        productId: line.productId,
        quantity: Math.max(1, Math.ceil(need)),
      });
      setShortbookNote(
        `${r.product.name} is on the ShortBook — need ${r.need} ${line.baseUnit}.`,
      );
    } catch (e) {
      setShortbookNote(apiErrorMessage(e));
    } finally {
      setShortbookBusy(null);
    }
  };

  // ---- Salt-based substitution (eVitalRx-style) --------------------------
  // When a line can't be filled, offer in-stock medicines of the SAME salt and
  // let the cashier swap in one tap.
  const [subFor, setSubFor] = useState<number | null>(null);
  const subProductId = subFor != null ? lines[subFor]?.productId : undefined;
  const { data: subData, isFetching: subsLoading } = useQuery({
    queryKey: ["pos-alternatives", subProductId],
    queryFn: () => inventoryApi.alternatives(subProductId!),
    enabled: !!subProductId,
  });

  const swapLine = (i: number, alt: AlternativeItem) => {
    // Seed a minimal product so the client preview has a base unit; the backend
    // still prices from the real product (we clear the per-line GST override).
    setKnownProducts((cur) => ({
      ...cur,
      [alt.productId]: {
        id: alt.productId,
        name: alt.name,
        sku: alt.sku,
        saltComposition: alt.saltComposition,
        baseUnit: alt.baseUnit,
        sellingPrice: alt.sellingPrice,
        taxRatePct: 0,
        packs: [],
      } as unknown as ProductRow,
    }));
    setLines((cur) =>
      cur.map((l, idx) =>
        idx === i
          ? {
              ...l,
              productId: alt.productId,
              productName: alt.name,
              salt: alt.saltComposition,
              baseUnit: alt.baseUnit,
              batchId: null,
              batchNumber: null,
              expiry: null,
              available: alt.available,
              unit: alt.baseUnit,
              unitPrice: String(alt.sellingPrice),
              taxRate: "", // let the server use the substitute's own GST rate
            }
          : l,
      ),
    );
    setSubFor(null);
  };

  /** How many BASE units of a hand-picked product can actually be sold. */
  const loadAvailabilityForProduct = async (productId: string) => {
    try {
      const inv = await inventoryApi.productInventory(productId);
      setLines((cur) =>
        cur.map((l) =>
          l.productId === productId && !l.batchId
            ? { ...l, available: inv.summary.available }
            : l,
        ),
      );
    } catch {
      // Non-fatal: checkout still refuses to oversell, server-side.
    }
  };

  /** Add a product from the search — a fresh FEFO line, or bump if already in. */
  const addProduct = (id: string) => {
    const p = productsById[id];
    if (!p) return;
    setKnownProducts((cur) => ({ ...cur, [id]: p }));
    setLines((cur) => {
      const idx = cur.findIndex((l) => l.productId === id && !l.batchId);
      if (idx >= 0)
        return cur.map((l, k) =>
          k === idx
            ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) }
            : l,
        );
      return [
        ...cur,
        {
          productId: id,
          productName: p.name,
          salt: p.saltComposition,
          baseUnit: p.baseUnit,
          batchId: null,
          batchNumber: null,
          expiry: null,
          available: null,
          unit: p.baseUnit,
          quantity: "1",
          unitPrice: String(p.sellingPrice),
          discount: "",
          discountMode: "amount",
          taxRate: String(p.taxRatePct),
        },
      ];
    });
    void loadAvailabilityForProduct(id);
  };

  /**
   * A scanned/typed barcode or shelf label. A label resolves to an exact lot and
   * pins the sale to it; a product barcode adds a normal FEFO line. Re-scanning
   * the same lot just bumps its quantity — supermarket-till behaviour.
   */
  const handleScan = async (raw: string) => {
    const code = raw.trim();
    if (!code || scanBusy.current) return;
    setScanError(null);
    scanBusy.current = true;
    try {
      const res = await inventoryApi.scan(code);
      const sp = res.product;
      if (!sp) throw new Error("Nothing matched that code.");
      setKnownProducts((cur) => ({
        ...cur,
        [sp.id]: sp as unknown as ProductRow,
      }));
      if (res.kind === "batch" && res.batch) {
        const b = res.batch;
        // A rejection must SOUND different. The scanner gun already beeped
        // when it decoded the barcode — if the app stayed silent here the
        // cashier would hear a normal beep and carry on, having added nothing.
        if (b.expired) {
          scanFeedback("error");
          setScanError(
            `${sp.name} · batch ${b.batchNumber} has EXPIRED — not added.`,
          );
          return;
        }
        if (res.available <= 0) {
          scanFeedback("error");
          setScanError(`${sp.name} · batch ${b.batchNumber} is out of stock.`);
          return;
        }
        setLines((cur) => {
          const idx = cur.findIndex((l) => l.batchId === b.id);
          if (idx >= 0)
            return cur.map((l, k) =>
              k === idx
                ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) }
                : l,
            );
          return [
            ...cur,
            {
              productId: sp.id,
              productName: sp.name,
              salt: sp.saltComposition,
              baseUnit: sp.baseUnit,
              batchId: b.id,
              batchNumber: b.batchNumber,
              expiry: b.expiryDate,
              available: res.available,
              unit: sp.baseUnit,
              quantity: "1",
              unitPrice: String(b.mrp || sp.sellingPrice),
              discount: "",
              discountMode: "amount",
              taxRate: String(sp.taxRatePct),
            },
          ];
        });
        scanFeedback("ok");
      } else {
        // Resolved to a product but not a specific lot — FEFO will choose, so
        // it went on the bill, but the cashier didn't pin a batch.
        addProduct(sp.id);
        scanFeedback("warn");
      }
    } catch (e) {
      scanFeedback("error");
      setScanError(apiErrorMessage(e));
    } finally {
      scanBusy.current = false;
    }
  };

  // A USB scanner types wherever focus happens to be, so listen page-wide.
  useScanGun((code) => void handleScan(code), {
    ignoreSelector: "#pos-search",
  });

  // Client-side preview (tax-exclusive). Backend computes authoritative totals.
  const calc = (l: DraftLine) => {
    const p = productsById[l.productId];
    const factor =
      !l.unit || !p || l.unit === p.baseUnit
        ? 1
        : (p.packs || []).find((x) => x.unit === l.unit)?.factor || 1;
    const qty = Number(l.quantity) || 0;
    const fallback = (p?.sellingPrice || 0) * factor;
    const unitPrice = l.unitPrice === "" ? fallback : Number(l.unitPrice) || 0;
    const gross = unitPrice * qty;
    const discountInput = Number(l.discount) || 0;
    const discount =
      l.discountMode === "pct"
        ? (gross * Math.min(discountInput, 100)) / 100
        : discountInput;
    const net = Math.max(gross - discount, 0);
    const rate = l.taxRate === "" ? p?.taxRatePct || 0 : Number(l.taxRate) || 0;
    // Mirror the server: when prices are tax-inclusive, the net already contains
    // the tax; otherwise tax is added on top.
    const taxable = priceIncludesTax ? net / (1 + rate / 100) : net;
    const tax = priceIncludesTax ? net - taxable : (taxable * rate) / 100;
    return { gross, discount, taxable, tax, total: taxable + tax };
  };

  /** Is this line asking for more than exists? Compared in BASE units. */
  const stockIssue = (l: DraftLine) => {
    if (l.available == null) return null;
    const p = productsById[l.productId];
    const factor =
      !l.unit || !p || l.unit === p.baseUnit
        ? 1
        : (p.packs || []).find((x) => x.unit === l.unit)?.factor || 1;
    const needBase = (Number(l.quantity) || 0) * factor;
    if (needBase <= l.available) return null;
    return {
      needBase,
      available: l.available,
      message:
        l.available <= 0
          ? `Out of stock${l.batchNumber ? ` · batch ${l.batchNumber}` : ""}`
          : `Only ${l.available} ${l.baseUnit} left`,
    };
  };

  const shortLines = lines
    .map((l, i) => ({ i, issue: stockIssue(l) }))
    .filter((x) => x.issue);

  const totals = lines.reduce(
    (acc, l) => {
      const c = calc(l);
      acc.subtotal += c.gross;
      acc.discount += c.discount;
      acc.taxable += c.taxable;
      acc.tax += c.tax;
      return acc;
    },
    { subtotal: 0, discount: 0, taxable: 0, tax: 0 },
  );
  const grand = Math.round(totals.taxable + totals.tax);
  const itemCount = lines.length;
  const qtyCount = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  const validLines: SaleLineInput[] = lines
    .filter((l) => l.productId && Number(l.quantity) > 0)
    .map((l) => ({
      productId: l.productId,
      batchId: l.batchId || undefined,
      unit: l.unit || undefined,
      quantity: Number(l.quantity),
      unitPrice: l.unitPrice === "" ? undefined : Number(l.unitPrice),
      discountAmount:
        l.discountMode === "amount" && l.discount !== ""
          ? Number(l.discount)
          : undefined,
      discountPct:
        l.discountMode === "pct" && l.discount !== ""
          ? Number(l.discount)
          : undefined,
      taxRatePct: l.taxRate === "" ? undefined : Number(l.taxRate),
    }));

  const canSubmit = validLines.length > 0 && shortLines.length === 0;
  const submit = () => {
    if (!validLines.length) return;
    mut.mutate(
      {
        customerId,
        taxType,
        paymentMode: paymentMode as never,
        lines: validLines,
      },
      {
        onSuccess: (sale) => {
          /**
           * Offer a refill call before leaving the screen.
           *
           * A 20-day course runs out on a knowable date, and the pharmacy that
           * rings first keeps the repeat. The days come from the base units
           * sold — one unit a day is the ordinary dosing assumption — and the
           * pharmacist can change the date before saving, because plenty of
           * medicines aren't once-daily.
           */
          const days = Math.round(
            validLines.reduce((t, l) => t + (Number(l.quantity) || 0), 0),
          );
          if (customerId && days >= 3) {
            setFollowUp({
              saleId: sale.id,
              days,
              customerName: selectedCustomer?.name || "the customer",
              medicine: lines[0]?.productName || "",
            });
            return;
          }
          navigation.navigate("SaleDetail", { id: sale.id });
        },
      },
    );
  };

  // Keyboard-first (web): F2 focuses search, Ctrl/Cmd+Enter completes the sale.
  // Latest submit/canSubmit are stashed in a ref (updated in an effect, never
  // during render) so the one-time key listener always calls the current one.
  const handlersRef = useRef({ submit, canSubmit });
  useEffect(() => {
    handlersRef.current = { submit, canSubmit };
  });
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("pos-search")?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (handlersRef.current.canSubmit) handlersRef.current.submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Sub-renderers -------------------------------------------------------

  const addBar = (
    <Combobox
      nativeID="pos-search"
      autoFocus
      placeholder="Search medicine by name or salt — or scan a barcode  (F2)"
      query={productQuery}
      onQueryChange={setProductQuery}
      items={productItems}
      loading={productsLoading}
      onSelect={(id) => addProduct(id)}
      onSubmitRaw={(code) => void handleScan(code)}
      leading={<Search size={18} color={palette.teal[600]} strokeWidth={2} />}
      emptyText="No medicine matches — try a salt name, or scan the pack"
    />
  );

  const cart = (
    <View style={{ marginTop: 14 }}>
      {wide && lines.length > 0 ? (
        <HStack style={styles.gridHead} gap={8} align="center">
          <Text style={{ flex: 1 }} variant="label-sm" tone="tertiary">
            ITEM
          </Text>
          <HeadCell w={COL.qty} label="QTY" />
          <HeadCell w={COL.unit} label="UNIT" />
          <HeadCell w={COL.price} label="PRICE" />
          <HeadCell w={COL.disc} label="DISCOUNT" />
          <HeadCell w={COL.gst} label="GST%" />
          <HeadCell w={COL.amount} label="AMOUNT" right />
          <View style={{ width: COL.rm }} />
        </HStack>
      ) : null}

      {lines.length === 0 ? (
        <Card style={{ marginTop: 4 }}>
          <EmptyState
            icon={ScanLine}
            title="No items yet"
            message="Search a medicine above or scan a pack to start billing. FEFO picks the nearest-expiry batch automatically."
          />
        </Card>
      ) : (
        <VStack gap={wide ? 0 : 12}>
          {lines.map((line, i) => {
            const c = calc(line);
            const issue = stockIssue(line);
            return (
              <React.Fragment key={i}>
                {wide ? (
                  <View
                    style={[styles.gridRow, i % 2 === 1 && styles.gridRowAlt]}
                  >
                    <HStack gap={8} align="center">
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="label" tone="primary" numberOfLines={1}>
                          {line.productName}
                        </Text>
                        {/* Wraps on purpose. Salt · lot · stock · Substitute ·
                            ShortBook is more than fits beside a 74px QTY box on
                            a 1280 laptop, and squeezing them shrank "Out of
                            stock" to three stacked words running under the
                            quantity input. A second line is the honest answer. */}
                        <HStack
                          gap={6}
                          align="center"
                          wrap
                          style={{ marginTop: 2 }}
                        >
                          {line.salt ? (
                            <Text
                              variant="caption"
                              tone="tertiary"
                              numberOfLines={1}
                            >
                              {line.salt}
                            </Text>
                          ) : null}
                          {line.batchId ? (
                            <View style={styles.lotBadge}>
                              <Text
                                variant="label-sm"
                                style={{ color: palette.teal[700] }}
                              >
                                {line.batchNumber}
                                {line.expiry
                                  ? ` · ${prettyExp(line.expiry)}`
                                  : ""}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.fefoBadge}>
                              <Text
                                variant="label-sm"
                                style={{ color: palette.text.tertiary }}
                              >
                                FEFO
                              </Text>
                            </View>
                          )}
                          {issue ? (
                            <Text
                              variant="caption"
                              tone="danger"
                              numberOfLines={1}
                            >
                              {issue.message}
                            </Text>
                          ) : line.available != null ? (
                            <Text
                              variant="caption"
                              tone="success"
                              numberOfLines={1}
                            >
                              {line.available} in stock
                            </Text>
                          ) : null}
                          {!line.batchId && line.salt ? (
                            <Pressable
                              onPress={() => setSubFor(subFor === i ? null : i)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel="Find a same-salt substitute"
                            >
                              <HStack gap={3} align="center">
                                <Repeat
                                  size={12}
                                  color={palette.teal[600]}
                                  strokeWidth={2}
                                />
                                <Text
                                  variant="caption"
                                  style={{ color: palette.teal[600] }}
                                >
                                  {issue ? "Substitute" : "Alt"}
                                </Text>
                              </HStack>
                            </Pressable>
                          ) : null}
                          {issue ? (
                            <ShortbookChip
                              busy={shortbookBusy === line.productId}
                              onPress={() =>
                                void addToShortbook(
                                  line,
                                  issue.needBase - Math.max(issue.available, 0),
                                )
                              }
                            />
                          ) : null}
                        </HStack>
                      </View>
                      <Cell
                        w={COL.qty}
                        value={line.quantity}
                        onChangeText={(v) => setLine(i, { quantity: v })}
                        error={!!issue}
                        align="center"
                      />
                      <View style={{ width: COL.unit }}>
                        <Select
                          value={line.unit}
                          options={unitOptions(line)}
                          onChange={(v) =>
                            setLine(i, {
                              unit: v,
                              unitPrice: priceForUnit(line.productId, v),
                            })
                          }
                        />
                      </View>
                      <Cell
                        w={COL.price}
                        value={line.unitPrice}
                        onChangeText={(v) => setLine(i, { unitPrice: v })}
                      />
                      <DiscCell
                        w={COL.disc}
                        line={line}
                        onValue={(v) => setLine(i, { discount: v })}
                        onMode={(m) => setLine(i, { discountMode: m })}
                      />
                      <Cell
                        w={COL.gst}
                        value={line.taxRate}
                        onChangeText={(v) => setLine(i, { taxRate: v })}
                        align="center"
                      />
                      <Text
                        variant="label"
                        tone="primary"
                        style={{ width: COL.amount, textAlign: "right" }}
                      >
                        {money(c.total)}
                      </Text>
                      <Pressable
                        onPress={() => removeLine(i)}
                        hitSlop={8}
                        style={{ width: COL.rm, alignItems: "center" }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.productName}`}
                      >
                        <Trash2
                          size={16}
                          color={palette.text.tertiary}
                          strokeWidth={2}
                        />
                      </Pressable>
                    </HStack>
                  </View>
                ) : (
                  // ---- Narrow: compact line card ----
                  <Card elevation="base">
                    <HStack align="center" justify="space-between">
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="label" tone="primary" numberOfLines={1}>
                          {line.productName}
                        </Text>
                        {line.salt ? (
                          <Text
                            variant="caption"
                            tone="tertiary"
                            numberOfLines={1}
                          >
                            {line.salt}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => removeLine(i)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.productName}`}
                      >
                        <Trash2
                          size={16}
                          color={palette.danger.text}
                          strokeWidth={2}
                        />
                      </Pressable>
                    </HStack>
                    <HStack gap={6} align="center" style={{ marginTop: 6 }}>
                      {line.batchId ? (
                        <View style={styles.lotBadge}>
                          <Text
                            variant="label-sm"
                            style={{ color: palette.teal[700] }}
                          >
                            {line.batchNumber}
                            {line.expiry ? ` · ${prettyExp(line.expiry)}` : ""}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.fefoBadge}>
                          <Text
                            variant="label-sm"
                            style={{ color: palette.text.tertiary }}
                          >
                            FEFO batch
                          </Text>
                        </View>
                      )}
                      {issue ? (
                        <Text variant="caption" tone="danger">
                          {issue.message}
                        </Text>
                      ) : line.available != null ? (
                        <Text variant="caption" tone="success">
                          {line.available} in stock
                        </Text>
                      ) : null}
                      {!line.batchId && line.salt ? (
                        <Pressable
                          onPress={() => setSubFor(subFor === i ? null : i)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="Find a same-salt substitute"
                        >
                          <HStack gap={3} align="center">
                            <Repeat
                              size={12}
                              color={palette.teal[600]}
                              strokeWidth={2}
                            />
                            <Text
                              variant="caption"
                              style={{ color: palette.teal[600] }}
                            >
                              {issue ? "Substitute" : "Alt"}
                            </Text>
                          </HStack>
                        </Pressable>
                      ) : null}
                      {issue ? (
                        <ShortbookChip
                          busy={shortbookBusy === line.productId}
                          onPress={() =>
                            void addToShortbook(
                              line,
                              issue.needBase - Math.max(issue.available, 0),
                            )
                          }
                        />
                      ) : null}
                    </HStack>
                    <HStack
                      gap={8}
                      align="flex-end"
                      wrap
                      style={{ marginTop: 10 }}
                    >
                      <Field label="Qty" w={64}>
                        <Cell
                          w={64}
                          value={line.quantity}
                          onChangeText={(v) => setLine(i, { quantity: v })}
                          error={!!issue}
                          align="center"
                        />
                      </Field>
                      <Field label="Unit" w={104}>
                        <Select
                          value={line.unit}
                          options={unitOptions(line)}
                          onChange={(v) =>
                            setLine(i, {
                              unit: v,
                              unitPrice: priceForUnit(line.productId, v),
                            })
                          }
                        />
                      </Field>
                      <Field label="Price" w={84}>
                        <Cell
                          w={84}
                          value={line.unitPrice}
                          onChangeText={(v) => setLine(i, { unitPrice: v })}
                        />
                      </Field>
                      <Field label="Disc" w={120}>
                        <DiscCell
                          w={120}
                          line={line}
                          onValue={(v) => setLine(i, { discount: v })}
                          onMode={(m) => setLine(i, { discountMode: m })}
                        />
                      </Field>
                      <Field label="GST%" w={56}>
                        <Cell
                          w={56}
                          value={line.taxRate}
                          onChangeText={(v) => setLine(i, { taxRate: v })}
                          align="center"
                        />
                      </Field>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text variant="caption" tone="tertiary">
                          Amount
                        </Text>
                        <Text variant="label-lg" tone="primary">
                          {money(c.total)}
                        </Text>
                      </View>
                    </HStack>
                  </Card>
                )}
                {subFor === i ? (
                  <SubstitutePanel
                    molecule={subData?.molecule}
                    items={subData?.items || []}
                    loading={subsLoading}
                    onSwap={(alt) => swapLine(i, alt)}
                    onClose={() => setSubFor(null)}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </VStack>
      )}
    </View>
  );

  const configCard = (
    <Card style={{ marginBottom: 12 }}>
      <VStack gap={14}>
        <Select
          label="Customer (walk-in if blank)"
          placeholder="Search name or mobile…"
          value={customerId}
          options={customerOptions}
          selectedLabel={
            selectedCustomer
              ? selectedCustomer.mobile
                ? `${selectedCustomer.name} · ${selectedCustomer.mobile}`
                : selectedCustomer.name
              : undefined
          }
          onSearch={setCustomerQuery}
          loading={customersLoading}
          onChange={pickCustomer}
          onCreate={async (label) => {
            const cst = await createCustomer.mutateAsync({ name: label });
            setKnownCustomers((cur) => ({ ...cur, [cst.id]: cst }));
            return { value: cst.id, label: cst.name };
          }}
          allowClear
        />
        <View>
          <Text variant="label-sm" tone="tertiary" style={{ marginBottom: 6 }}>
            GST TYPE
          </Text>
          <ChipsRow
            chips={[
              { key: "intra", label: "Intra (CGST+SGST)" },
              { key: "inter", label: "Inter (IGST)" },
            ]}
            active={taxType}
            onChange={(k) => setTaxType(k as never)}
          />
        </View>
        <View>
          <Text variant="label-sm" tone="tertiary" style={{ marginBottom: 6 }}>
            PAYMENT
          </Text>
          <ChipsRow
            chips={[
              { key: "cash", label: "Cash" },
              { key: "card", label: "Card" },
              { key: "upi", label: "UPI" },
              { key: "credit", label: "Credit" },
            ]}
            active={paymentMode}
            onChange={setPaymentMode}
          />
        </View>
      </VStack>
    </Card>
  );

  const totalsCard = (
    <Card style={{ marginBottom: 12 }}>
      <VStack gap={8}>
        <Row
          label={`Subtotal · ${itemCount} item${itemCount === 1 ? "" : "s"}`}
          value={money(totals.subtotal)}
        />
        {totals.discount > 0 && (
          <Row label="Discount" value={`- ${money(totals.discount)}`} />
        )}
        <Row label="Taxable" value={money(totals.taxable)} />
        {taxType === "intra" ? (
          <>
            <Row label="CGST" value={money(totals.tax / 2)} muted />
            <Row
              label="SGST"
              value={money(
                totals.tax - Math.round((totals.tax / 2) * 100) / 100,
              )}
              muted
            />
          </>
        ) : (
          <Row label="IGST" value={money(totals.tax)} muted />
        )}
        <View style={styles.divider} />
        <HStack justify="space-between" align="center">
          <Text variant="h3" tone="primary">
            Grand total
          </Text>
          <Text variant="display-sm" tone="accent">
            {money(grand)}
          </Text>
        </HStack>
        <Text variant="caption" tone="tertiary">
          {qtyCount} unit{qtyCount === 1 ? "" : "s"} · GST-rounded on the server
        </Text>
      </VStack>
    </Card>
  );

  const rail = (
    <View style={railSide ? [styles.rail, stickyStyle] : undefined}>
      {configCard}
      {totalsCard}
      {scanError ? (
        <Banner
          tone="warning"
          message={scanError}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {shortbookNote ? (
        <Banner
          tone="info"
          message={shortbookNote}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {shortLines.length > 0 ? (
        <Banner
          tone="warning"
          title="Not enough stock to complete this sale"
          style={{ marginBottom: 12 }}
        >
          {shortLines.map(({ i, issue }) => (
            <Text key={i} variant="caption" tone="warning">
              {lines[i].productName}: asked {issue!.needBase},{" "}
              {issue!.message.charAt(0).toLowerCase() + issue!.message.slice(1)}
            </Text>
          ))}
        </Banner>
      ) : null}
      {mut.isError ? (
        <Banner
          tone="danger"
          message={apiErrorMessage(mut.error)}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <Button
        label={grand > 0 ? `Complete sale · ${money(grand)}` : "Complete sale"}
        size="lg"
        loading={mut.isPending}
        disabled={!canSubmit}
        onPress={submit}
        icon={<ShoppingCart size={18} color="#FFFFFF" strokeWidth={2} />}
      />
      {wide ? (
        <HStack gap={8} justify="center" style={{ marginTop: 12 }}>
          <KeyHint k="F2" label="Search" />
          <KeyHint k="Ctrl ↵" label="Complete" />
        </HStack>
      ) : null}
    </View>
  );

  return (
    <Screen
      back="Back to sales"
      overline="Sales"
      title="New sale"
      subtitle="Scan or search · FEFO auto-picks nearest-expiry batches"
      right={
        <HStack gap={8}>
          {/* A counter that can't silence the beeps ends up with the machine
              volume down, which kills the error tone too. */}
          <Button
            label={soundOff ? "Sound off" : "Sound on"}
            variant="secondary"
            fullWidth={false}
            icon={
              soundOff ? (
                <VolumeX
                  size={16}
                  color={palette.text.tertiary}
                  strokeWidth={2}
                />
              ) : (
                <Volume2
                  size={16}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              )
            }
            onPress={() => {
              const next = !soundOff;
              setSoundOff(next);
              setScanSoundMuted(next);
              if (!next) scanFeedback("ok"); // prove it works when turning it on
            }}
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
          {/* Separate from "Camera": that one decodes a barcode, this one reads
              printed text. Most strips have no barcode at all, so without this
              the only way to pin a batch is to type it. */}
          <Button
            label="Read pack"
            variant="secondary"
            fullWidth={false}
            icon={
              <ScanText
                size={16}
                color={palette.text.primary}
                strokeWidth={2}
              />
            }
            onPress={() => setPackOpen(true)}
          />
          <Button
            label="Invoices"
            variant="secondary"
            fullWidth={false}
            icon={
              <History size={16} color={palette.text.primary} strokeWidth={2} />
            }
            onPress={() => navigation.navigate("SalesList")}
          />
        </HStack>
      }
    >
      <View
        style={{
          flexDirection: railSide ? "row" : "column",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, minWidth: 0, width: "100%" }}>
          {addBar}
          {cart}
          {lines.length > 0 ? (
            <HStack gap={6} align="center" style={{ marginTop: 12 }}>
              <PackageX
                size={14}
                color={palette.text.tertiary}
                strokeWidth={2}
              />
              <Text variant="caption" tone="tertiary">
                Tip: scan the same pack again to add another unit · use the bin
                icon to remove a line
              </Text>
            </HStack>
          ) : null}
        </View>
        <View style={{ width: railSide ? 344 : "100%" }}>{rail}</View>
      </View>

      {/*
        Refill follow-up. Offered, never automatic: a reminder the pharmacist
        didn't ask for is noise, and noise is how a reminders list stops being
        read at all.
      */}
      <ConfirmDialog
        visible={Boolean(followUp)}
        title="Set a refill reminder?"
        message={
          followUp
            ? `${followUp.customerName} bought ${followUp.days} ${followUp.days === 1 ? "unit" : "units"}${followUp.medicine ? ` of ${followUp.medicine}` : ""}. Remind you to call them in ${followUp.days} days, when the course runs out?`
            : ""
        }
        confirmLabel={`Remind me in ${followUp?.days ?? 0} days`}
        cancelLabel="No thanks"
        loading={createReminder.isPending}
        onConfirm={() => {
          if (!followUp) return;
          const due = new Date();
          due.setDate(due.getDate() + followUp.days);
          due.setHours(10, 0, 0, 0);
          createReminder.mutate(
            {
              title: `Refill call — ${followUp.customerName}${followUp.medicine ? ` · ${followUp.medicine}` : ""}`,
              notes: `Course of ${followUp.days} units sold on ${new Date().toLocaleDateString("en-IN")}.`,
              dueAt: due.toISOString(),
              priority: "normal",
            },
            {
              // The sale is already saved; a failed reminder must not strand
              // the pharmacist on the billing screen.
              onSettled: () => {
                const id = followUp.saleId;
                setFollowUp(null);
                navigation.navigate("SaleDetail", { id });
              },
            },
          );
        }}
        onCancel={() => {
          const id = followUp?.saleId;
          setFollowUp(null);
          if (id) navigation.navigate("SaleDetail", { id });
        }}
      />

      <CameraScanner
        visible={scanOpen}
        title="Scan pack barcode"
        onDetected={(code) => {
          setScanOpen(false);
          void handleScan(code);
        }}
        onClose={() => setScanOpen(false)}
      />

      {/* Feeds the SAME handleScan path as a barcode, so the expiry guard,
          out-of-stock guard and line de-duplication behave identically however
          the lot was identified. Prefers the shelf-label code when the lot has
          one — it's unambiguous even if two products share a batch number. */}
      {packOpen && (
        <PackTextScanner
          onPicked={(m) => {
            setPackOpen(false);
            void handleScan(m.batch.labelCode || m.batch.batchNumber);
          }}
          onClose={() => setPackOpen(false)}
        />
      )}
    </Screen>
  );
}

// ---- small building blocks -------------------------------------------------

/**
 * "Note it to buy" — the other half of what you do with a line you can't fill.
 * Sits beside Substitute, in the same chip row, because they are the two ways
 * out of the same dead end and the cashier picks between them.
 */
function ShortbookChip({
  busy,
  onPress,
}: {
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Add to ShortBook"
    >
      <HStack gap={3} align="center">
        <ListPlus size={12} color={palette.teal[700]} strokeWidth={2} />
        <Text variant="caption" style={{ color: palette.teal[700] }}>
          {busy ? "Adding…" : "ShortBook"}
        </Text>
      </HStack>
    </Pressable>
  );
}

/** Same-salt, in-stock substitutes for a line that can't be filled (eVitalRx). */
function SubstitutePanel({
  molecule,
  items,
  loading,
  onSwap,
  onClose,
}: {
  molecule?: string;
  items: AlternativeItem[];
  loading: boolean;
  onSwap: (alt: AlternativeItem) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.subPanel}>
      <HStack
        align="center"
        justify="space-between"
        style={{ marginBottom: 6 }}
      >
        <HStack gap={6} align="center" style={{ flex: 1, minWidth: 0 }}>
          <Repeat size={14} color={palette.teal[600]} strokeWidth={2} />
          <Text variant="label-sm" tone="secondary" numberOfLines={1}>
            In-stock substitutes{molecule ? ` · ${molecule}` : ""}
          </Text>
        </HStack>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityLabel="Close substitutes"
        >
          <X size={16} color={palette.text.tertiary} strokeWidth={2} />
        </Pressable>
      </HStack>
      {loading ? (
        <Text variant="caption" tone="tertiary">
          Finding same-salt medicines…
        </Text>
      ) : items.length === 0 ? (
        <Text variant="caption" tone="tertiary">
          No other in-stock medicine shares this salt.
        </Text>
      ) : (
        <VStack gap={0}>
          {items.slice(0, 5).map((alt) => (
            <HStack
              key={alt.productId}
              align="center"
              justify="space-between"
              gap={10}
              style={styles.subRow}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label-sm" tone="primary" numberOfLines={1}>
                  {alt.name}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {alt.brandName ? `${alt.brandName} · ` : ""}
                  {alt.available} in stock · {money(alt.sellingPrice)}/
                  {alt.baseUnit}
                </Text>
              </View>
              <Button
                label="Swap"
                size="sm"
                variant="secondary"
                fullWidth={false}
                icon={
                  <CheckCircle2
                    size={14}
                    color={palette.teal[600]}
                    strokeWidth={2}
                  />
                }
                onPress={() => onSwap(alt)}
              />
            </HStack>
          ))}
        </VStack>
      )}
    </View>
  );
}

/**
 * Fixed widths for everything except the medicine name, which takes the rest.
 * Trimmed from 588 to 552 total so the name keeps a workable share on a 1400px
 * laptop — the columns below hold short numbers and were sized generously.
 */
const COL = {
  qty: 60,
  unit: 84,
  price: 82,
  disc: 104,
  gst: 52,
  amount: 84,
  rm: 30,
};

function HeadCell({
  w,
  label,
  right,
}: {
  w: number;
  label: string;
  right?: boolean;
}) {
  return (
    <Text
      style={{ width: w, textAlign: right ? "right" : "center" }}
      variant="label-sm"
      tone="tertiary"
    >
      {label}
    </Text>
  );
}

function Cell({
  w,
  value,
  onChangeText,
  align = "left",
  error,
}: {
  w: number;
  value: string;
  onChangeText: (v: string) => void;
  align?: "left" | "center" | "right";
  error?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={[
        styles.cell,
        { width: w, textAlign: align },
        error && {
          borderColor: palette.danger.text,
          backgroundColor: palette.danger.bg,
        },
        // @ts-expect-error web-only outline reset
        { outlineStyle: "none" },
      ]}
    />
  );
}

function DiscCell({
  w,
  line,
  onValue,
  onMode,
}: {
  w: number;
  line: DraftLine;
  onValue: (v: string) => void;
  onMode: (m: "amount" | "pct") => void;
}) {
  return (
    <View style={[styles.discWrap, { width: w }]}>
      <TextInput
        value={line.discount}
        onChangeText={onValue}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={palette.text.tertiary}
        selectTextOnFocus
        // @ts-expect-error web-only outline reset
        style={[styles.discInput, { outlineStyle: "none" }]}
      />
      <View style={styles.discToggle}>
        {(["amount", "pct"] as const).map((m) => {
          const active = line.discountMode === m;
          return (
            <Pressable
              key={m}
              onPress={() => onMode(m)}
              style={[styles.discToggleBtn, active && styles.discToggleBtnOn]}
              accessibilityRole="button"
              accessibilityLabel={
                m === "amount" ? "Discount in rupees" : "Discount in percent"
              }
            >
              <Text
                variant="label-sm"
                style={{ color: active ? "#FFFFFF" : palette.text.tertiary }}
              >
                {m === "amount" ? "₹" : "%"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({
  label,
  w,
  children,
}: {
  label: string;
  w: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ width: w }}>
      <Text variant="label-sm" tone="tertiary" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function KeyHint({ k, label }: { k: string; label: string }) {
  return (
    <HStack gap={5} align="center">
      <View style={styles.keycap}>
        <Text variant="label-sm" style={{ color: palette.text.secondary }}>
          {k}
        </Text>
      </View>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </HStack>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <HStack justify="space-between">
      <Text variant="body-sm" tone={muted ? "tertiary" : "secondary"}>
        {label}
      </Text>
      <Text variant="label" tone={muted ? "tertiary" : "primary"}>
        {value}
      </Text>
    </HStack>
  );
}

const stickyStyle =
  Platform.OS === "web" ? ({ position: "sticky", top: 8 } as never) : undefined;

const styles = StyleSheet.create({
  rail: {},
  gridHead: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.default,
  },
  gridRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  gridRowAlt: { backgroundColor: palette.ink[50] },
  subPanel: {
    marginTop: 2,
    marginBottom: 8,
    marginHorizontal: 6,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.teal[100],
    backgroundColor: palette.teal[50],
  },
  subRow: {
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: palette.teal[100],
  },
  cell: {
    height: 40,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    fontSize: 14,
    color: palette.text.primary,
    backgroundColor: palette.surface.primary,
  },
  discWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.sm,
    backgroundColor: palette.surface.primary,
    overflow: "hidden",
  },
  discInput: {
    flex: 1,
    // Without this, react-native-web won't shrink the input below its intrinsic
    // width, pushing the ₹/% toggle past the cell where overflow:hidden clips it.
    minWidth: 0,
    height: 38,
    paddingHorizontal: 8,
    fontSize: 14,
    color: palette.text.primary,
  },
  discToggle: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderLeftColor: palette.border.default,
  },
  discToggleBtn: {
    width: 26,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  discToggleBtnOn: { backgroundColor: palette.teal[700] },
  lotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: palette.teal[50],
  },
  fefoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: palette.ink[100],
  },
  keycap: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: palette.border.strong,
    backgroundColor: palette.surface.primary,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border.default,
    marginVertical: 4,
  },
});
