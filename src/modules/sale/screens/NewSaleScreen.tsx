import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Modal,
  useWindowDimensions,
} from "react-native";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  Paperclip,
  ChevronDown,
} from "lucide-react-native";
import { CameraScanner } from "@shared/CameraScanner";
import { PackTextScanner } from "@shared/PackTextScanner";
import {
  scanFeedback,
  setScanSoundMuted,
  isScanSoundMuted,
} from "@shared/scanFeedback";
import { useProducts } from "@modules/product/hooks/useProducts";
import { productApi } from "@modules/product/api/productApi";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { AlternativeItem } from "@modules/inventory/types";
import { useScanGun } from "@shared/useScanGun";
import { TextField } from "@shared/ui/TextField";
import { RxGateModal } from "@modules/sale/components/RxGateModal";
import { NewCustomerDialog } from "@modules/sale/components/NewCustomerDialog";
import { genOpId, useOfflineStore } from "@shared/offline/useOfflineStore";
import { localCatalog } from "@shared/offline/localCatalog";
import { aboveMrp, maxUnitPrice, GST_SLABS } from "@shared/offline/pricing";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import {
  useCustomers,
  useCreateCustomer,
} from "@modules/customer/hooks/useCustomers";
import { useCreateSale, useInvoiceProfile } from "@modules/sale/hooks/useSales";
import { useCreateReminder } from "@modules/reminder/hooks/useReminders";
import { SaleLineInput, Sale } from "@modules/sale/types";
import { printInvoice } from "@modules/sale/invoice";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoney, fmtMoneyExact, fmtDate } from "@shared/format";
import { sanitizeDecimal } from "@shared/numericInput";
import { draftKey, parseDraft, serializeDraft } from "@modules/sale/saleDraft";
import { saleBlocker } from "@modules/sale/saleBlocker";
import { layout, palette, radius } from "@shared/designSystem";
import { useTabBottomPadding } from "@shared/ui/useBottomPadding";
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
import { useAiScanConsent } from "@shared/useAiScanConsent";

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
  /**
   * MRP per base unit of the lot FEFO will sell first. The bill's default
   * price — a lot carries the MRP printed on it, which the catalogue figure
   * on the product does not know.
   */
  lotMrp?: number | null;
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
/**
 * Ring this many days BEFORE the course runs out.
 *
 * Calling on the day it finishes is already too late: the customer has either
 * missed a dose or bought elsewhere on the way home. Retail pharmacy CRMs
 * (Walgreens, CVS, Boots) all notify a few days ahead for exactly this reason —
 * the reminder is worth nothing unless there is time left to act on it, order
 * what is short, or arrange a delivery.
 */
const REFILL_LEAD_DAYS = 3;

/**
 * The server caps discountPct and taxRatePct at 100 and clamps an absolute
 * discount to the line's gross. Keep the box inside those bounds: a value the
 * server rejects comes back as "Validation error" naming no field, with a queue
 * waiting. Blank and half-typed values pass through untouched.
 */
const clampInput = (v: string, max: number, min = 0) => {
  if (v.trim() === "") return v;
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  if (n < min) return String(min);
  if (n > max) return String(Math.round(max * 100) / 100);
  return v;
};

/** The clamped value plus what to say about it — silently rewriting a typed
 *  figure leaves the cashier believing they entered something else. */
const clampWithNote = (
  v: string,
  max: number,
  label: string,
): { value: string; note: string | null } => {
  const clamped = clampInput(v, max);
  if (clamped === v) return { value: v, note: null };
  const n = Number(v);
  if (Number.isNaN(n)) return { value: clamped, note: null };
  return {
    value: clamped,
    note:
      n < 0
        ? `${label} cannot be negative — set to 0.`
        : `${label} capped at ${clamped}.`,
  };
};

/** The till's search, where the next keystroke belongs after any add. */
const focusSearch = () => {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.getElementById("pos-search")?.focus();
  }
};

const focusQty = (i: number) => {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.getElementById(`pos-qty-${i}`)?.focus();
  }
};

/** A Modal is up: keys belong to it, not to the till underneath. */
const modalOpen = () =>
  typeof document !== "undefined" &&
  document.querySelector('[aria-modal="true"]') !== null;

interface Availability {
  available: number | null;
  lotMrp: number | null;
  lots: Map<string, number>;
}

export default function NewSaleScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  // The drawer keeps this screen mounted behind every other page, so anything
  // listening on the whole document has to stand down when it isn't showing.
  const isFocused = useIsFocused();
  const tabClearance = useTabBottomPadding(0);
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
   * The columns are now narrow enough that 1024 leaves the name ~270px and 1366
   * ~250px, with discount, GST and Remove off the Tab path.
   *
   * Two separate questions, deliberately split. Whether the TOTALS sit beside
   * the cart is about page shape; whether the LINE ITEMS use a column grid is
   * about how much room the medicine name has. Tying both to one flag meant
   * fixing the cramped row would also push "Grand total" and "Complete sale"
   * below the fold on a 1366 counter PC — trading a layout bug for a slower
   * sale.
   */
  const railSide = width >= 1200;
  const wide = width >= 1024;

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
  // "Doct:" on the bill and the prescriber in the Schedule H register.
  const [doctorName, setDoctorName] = useState("");
  // The prescription this sale is dispensed against, once the gate has run.
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [rxGateOpen, setRxGateOpen] = useState(false);
  /**
   * Why the prescription sheet is open. "gate" means a scheduled item stopped
   * the sale, so finishing it should carry straight on to the bill; "attach"
   * means the pharmacist opened it themselves and the sale is not ready yet.
   */
  const [rxPurpose, setRxPurpose] = useState<"gate" | "attach">("gate");
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
  const { data: invoiceProfile, isFetched: profileSettled } =
    useInvoiceProfile();
  const priceIncludesTax = invoiceProfile?.tax?.priceIncludesTax ?? false;
  const taxEnabled = invoiceProfile?.tax?.enabled !== false;
  // The GST box stays for whoever could correct the product itself, because
  // rates change and product data goes stale. The server applies the same rule.
  const canEditGst =
    useAuthStore((s) => s.hasPermission)(PERMISSIONS.PRODUCTS_MANAGE) &&
    taxEnabled;

  const [customerId, setCustomerId] = useState<string | null>(null);

  /* Quick-add customer, opened from the picker's create row. */
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);

  const [taxType, setTaxType] = useState<"intra" | "inter">("intra");
  const [paymentMode, setPaymentMode] = useState("cash");
  /**
   * How many days the course runs, chosen while billing.
   *
   * "" means "work it out from the quantity", which is what the app did before
   * and is right for a plain strip-a-day medicine. The picker exists because
   * plenty of courses are not once-daily: 1 bottle of syrup is not a 1-day
   * course, and a 10-day antibiotic sold as 2 strips is not 20 days. The
   * pharmacist knows; now they can say so at the counter rather than correcting
   * a guessed date afterwards.
   */
  const [refillDays, setRefillDays] = useState<string>("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  /**
   * Opened straight from the phone's Scan button, so the camera is already up
   * by the time the screen paints — the whole point of that button is to skip
   * a tap, and landing on a screen that then needs one gives it back.
   */
  const route = useRoute();
  /** "qr" = barcode camera, "pack" = batch-number OCR. `true` = legacy, means qr. */
  const autoScan = (route.params as { autoScan?: boolean | string } | undefined)
    ?.autoScan;
  const [scanOpen, setScanOpen] = useState(false);
  /** Camera OCR for packs whose batch number is printed as text, not a barcode. */
  const [packOpen, setPackOpen] = useState(false);
  /** Pack reading sends the photo to Gemini — ask first, and before the
      scanner Modal opens (iOS won't stack a dialog on top of it). */
  const { ensure: ensureAiConsent, dialog: aiConsentDialog } =
    useAiScanConsent();
  const openPackScanner = useCallback(async () => {
    if (await ensureAiConsent()) setPackOpen(true);
  }, [ensureAiConsent]);

  /**
   * Consume the flag in an effect, not in `useState(autoScan)`.
   *
   * A state initialiser runs ONCE, at mount. The Sales stack keeps this screen
   * alive, so every tap after the first navigated to an already-mounted screen
   * and the camera never opened — the button appeared dead. Worst on the most
   * common path of all: you are already on New sale when you reach for it.
   *
   * The param is cleared straight after. Leaving it true means the next tap
   * sets the same value, the effect doesn't re-run, and the button dies again.
   */
  useEffect(() => {
    if (!autoScan) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot nav param
    if (autoScan === "pack") void openPackScanner();
    else setScanOpen(true);
    navigation.setParams({ autoScan: false });
  }, [autoScan, navigation, openPackScanner]);
  const [soundOff, setSoundOff] = useState(isScanSoundMuted());
  /** Refill follow-up offered right after a sale completes. */
  const [followUp, setFollowUp] = useState<{
    saleId: string;
    days: number;
    customerName: string;
    /** Snapshot of the number on file, so the reminder can dial it later. */
    customerId: string | null;
    mobile: string;
    medicine: string;
  } | null>(null);
  const createReminder = useCreateReminder();
  const scanQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastScanMiss = useRef<string | null>(null);
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
    right: `${fmtMoneyExact(p.sellingPrice)}/${p.baseUnit}`,
    codes: [p.sku, p.barcode],
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

  /**
   * Save the quick-added customer and select them for this sale.
   *
   * The duplicate-mobile 409 is shown in the dialog rather than as a toast: the
   * number is right there to correct, and the half-typed name would be lost if
   * the dialog closed.
   */
  const createCustomerWithMobile = async (values: {
    name: string;
    mobile: string;
  }) => {
    setNewCustomerError(null);
    try {
      const cst = await createCustomer.mutateAsync({
        name: values.name,
        ...(values.mobile ? { mobile: values.mobile } : {}),
      });
      setKnownCustomers((cur) => ({ ...cur, [cst.id]: cst }));
      setCustomerId(cst.id);
      setNewCustomerOpen(false);
    } catch (err) {
      setNewCustomerError(apiErrorMessage(err, "Could not add the customer"));
    }
  };

  const unitOptions = (line: DraftLine) => {
    const p = productsById[line.productId];
    if (!p) return [{ value: line.baseUnit, label: line.baseUnit }];
    return [
      { value: p.baseUnit, label: `${p.baseUnit} (base)`, short: p.baseUnit },
      ...(p.packs || []).map((pk) => ({
        value: pk.unit,
        label: `${pk.unit} (×${pk.factor})`,
        short: pk.unit,
      })),
    ];
  };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((cur) =>
      cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );

  /**
   * The price a line starts at, already inside the MRP. With GST-exclusive
   * pricing that means below the MRP by the tax, or the first sale of every
   * medicine would be refused. A price typed over this is the cashier's call
   * and gets the error at the box instead.
   */
  const seedPrice = (
    base: number,
    mrpPerBase: number,
    factor: number,
    productRate: number,
  ) => {
    const price = Math.round(base * factor * 100) / 100;
    if (!(mrpPerBase > 0)) return String(price);
    const rate = taxEnabled ? productRate : 0;
    return String(
      Math.min(price, maxUnitPrice(mrpPerBase, factor, rate, priceIncludesTax)),
    );
  };

  /**
   * Price for a product in a given unit = base price × that unit's pack factor.
   * The base price is the selling lot's MRP when known, else the product's.
   */
  const priceForUnit = (
    productId: string,
    unit: string | null,
    lotMrp?: number | null,
    known?: ProductRow,
  ) => {
    const p = known ?? productsById[productId];
    if (!p) return "";
    const factor =
      !unit || unit === p.baseUnit
        ? 1
        : (p.packs || []).find((x) => x.unit === unit)?.factor || 1;
    const hasLot = Boolean(lotMrp && lotMrp > 0);
    return seedPrice(
      hasLot ? (lotMrp as number) : p.sellingPrice || 0,
      hasLot ? (lotMrp as number) : p.mrp || 0,
      factor,
      p.taxRatePct || 0,
    );
  };
  const removeLine = (i: number) =>
    setLines((cur) => cur.filter((_, idx) => idx !== i));

  /**
   * Note a medicine that couldn't be sold, from the till.
   *
   * Offered on EVERY line, not only the ones that can't be filled. A short is
   * the loudest reason to note something down, but it is not the only one: the
   * pharmacist selling the last two strips of a fast mover knows it needs
   * reordering before the system does, and that judgement is worth one tap
   * while the pack is in their hand. Restricting it to out-of-stock lines meant
   * the moment to record it had already passed.
   *
   * The quantity sent is the SHORTFALL where there is one — asking for 20 and
   * getting 6 is a different signal from asking for one — and otherwise the
   * quantity being sold. ShortBook only ever raises an existing reorder level,
   * never lowers it, so a tap can't undo a level someone set deliberately.
   */
  const [shortbookBusy, setShortbookBusy] = useState<string | null>(null);
  const [shortbookNote, setShortbookNote] = useState<string | null>(null);
  const addToShortbook = async (line: DraftLine, want: number) => {
    setShortbookBusy(line.productId);
    setShortbookNote(null);
    try {
      const r = await inventoryApi.addToShortbook({
        productId: line.productId,
        quantity: Math.max(1, Math.ceil(want)),
      });
      setShortbookNote(
        r.need > 0
          ? `${r.product.name} is on the ShortBook — need ${r.need} ${line.baseUnit}.`
          : `${r.product.name} is on the ShortBook — keep ${r.reorderLevel} ${line.baseUnit}, ${r.onHand} in stock.`,
      );
    } catch (e) {
      setShortbookNote(apiErrorMessage(e));
    } finally {
      setShortbookBusy(null);
    }
  };

  /** What a ShortBook tap on this line should ask for. */
  const shortbookQty = (l: DraftLine) => {
    const issue = stockIssue(l);
    if (issue) return issue.needBase - Math.max(issue.available, 0);
    return Number(l.quantity) || 1;
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
              lotMrp: null, // the old medicine's lot says nothing about this one
              taxRate: "", // let the server use the substitute's own GST rate
            }
          : l,
      ),
    );
    setSubFor(null);
    void loadAvailabilityForProduct(alt.productId);
  };

  /** How many BASE units of a hand-picked product can actually be sold. */
  const fetchAvailability = async (productId: string) => {
    let available: number | null = null;
    let lotMrp: number | null = null;
    /** Stock of each lot, for lines pinned to one by a scanned label. */
    const lots = new Map<string, number>();
    try {
      const inv = await inventoryApi.productInventory(productId);
      // The lot FEFO sells first: nearest expiry, unexpired, in stock.
      const first = inv.batches.find((b) => !b.expired && b.onHand > 0);
      available = inv.summary.available;
      lotMrp = first?.mrp && first.mrp > 0 ? first.mrp : null;
      for (const b of inv.batches)
        lots.set(b.batchId, b.expired ? 0 : b.onHand);
    } catch {
      // That endpoint needs inventory.view, which a till-only cashier may not
      // hold; the synced mirror has the same lots. Without either it is still
      // non-fatal: checkout refuses to oversell, server-side.
      const first = localCatalog.fefoCandidates(productId)[0];
      if (!first) return null;
      available = localCatalog.availableForProduct(productId);
      lotMrp = first.batch.mrp && first.batch.mrp > 0 ? first.batch.mrp : null;
    }
    return { available, lotMrp, lots };
  };

  /**
   * Puts fresh stock and the lot's MRP on a product's lines. `known` is for a
   * product the render's own lookup can't see yet; `was` for one whose price
   * has moved, since a line "on the default price" means the old default.
   */
  const applyAvailability = (
    productId: string,
    { available, lotMrp, lots }: Availability,
    known?: ProductRow,
    was?: ProductRow,
  ) =>
    setLines((cur) =>
      cur.map((l) => {
        if (l.productId !== productId) return l;
        if (l.batchId) {
          const onHand = lots.get(l.batchId);
          return onHand == null ? l : { ...l, available: onHand };
        }
        // Re-price only a line still on the default price — never over a
        // price the cashier typed.
        const untouched =
          Math.abs(
            Number(l.unitPrice) -
              Number(priceForUnit(productId, l.unit, l.lotMrp, was ?? known)),
          ) < 0.01;
        return {
          ...l,
          available,
          lotMrp,
          unitPrice: untouched
            ? priceForUnit(productId, l.unit, lotMrp, known)
            : l.unitPrice,
        };
      }),
    );

  const loadAvailabilityForProduct = async (
    productId: string,
    known?: ProductRow,
  ) => {
    const found = await fetchAvailability(productId);
    if (found) applyAvailability(productId, found, known);
  };

  /**
   * Add a product from the search — a fresh FEFO line, or bump if already in.
   * `known` carries a row fresh off a scan: this render's lookup predates it, so
   * reading it there dropped every scanned product outside the first 50.
   */
  const addProduct = (id: string, known?: ProductRow) => {
    const p = known ?? productsById[id];
    if (!p) return;
    setScanError(null);
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
          unitPrice: seedPrice(
            p.sellingPrice,
            p.mrp || 0,
            1,
            p.taxRatePct || 0,
          ),
          discount: "",
          discountMode: "pct",
          taxRate: String(p.taxRatePct),
        },
      ];
    });
    void loadAvailabilityForProduct(id, p);
  };

  /**
   * A scanned/typed barcode or shelf label. A label resolves to an exact lot and
   * pins the sale to it; a product barcode adds a normal FEFO line. Re-scanning
   * the same lot just bumps its quantity — supermarket-till behaviour.
   */
  const resolveScan = async (code: string): Promise<boolean> => {
    setScanError(null);
    try {
      const res = await inventoryApi.scan(code);
      const sp = res.product;
      if (!sp) throw new Error("Nothing matched that code.");
      const row = sp as unknown as ProductRow;
      setKnownProducts((cur) => ({ ...cur, [sp.id]: row }));
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
          return true;
        }
        if (res.available <= 0) {
          scanFeedback("error");
          setScanError(`${sp.name} · batch ${b.batchNumber} is out of stock.`);
          return true;
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
              lotMrp: b.mrp || null,
              unitPrice: seedPrice(
                b.mrp || sp.sellingPrice,
                b.mrp || sp.mrp || 0,
                1,
                sp.taxRatePct || 0,
              ),
              discount: "",
              discountMode: "pct",
              taxRate: String(sp.taxRatePct),
            },
          ];
        });
        scanFeedback("ok");
      } else {
        // Resolved to a product but not a specific lot — FEFO will choose, so
        // it went on the bill, but the cashier didn't pin a batch.
        addProduct(sp.id, row);
        scanFeedback("warn");
      }
      return true;
    } catch (e) {
      lastScanMiss.current = apiErrorMessage(e);
      return false;
    }
  };

  // Latest closure: a queued scan may run long after the render that queued it.
  const resolveScanRef = useRef(resolveScan);
  useEffect(() => {
    resolveScanRef.current = resolveScan;
  });

  /**
   * Scans run one at a time, in the order they arrived: a gun fires faster than
   * /inventory/scan answers, and two lines racing can't merge into one. Resolves
   * false on a miss, leaving the caller to say so or try something else.
   */
  const queueScan = (raw: string): Promise<boolean> => {
    const code = raw.trim();
    if (!code) return Promise.resolve(true);
    const run = scanQueue.current.then(() => resolveScanRef.current(code));
    scanQueue.current = run;
    return run;
  };

  const reportScanMiss = (code: string) => {
    scanFeedback("error");
    setScanError(lastScanMiss.current || `Nothing matches "${code}".`);
  };

  const handleScan = async (raw: string) => {
    if (!(await queueScan(raw))) reportScanMiss(raw.trim());
  };

  // A USB scanner types wherever focus happens to be, so listen page-wide.
  useScanGun((code) => void handleScan(code), {
    enabled: isFocused,
    ignoreSelector: "#pos-search",
  });

  const factorOf = (l: DraftLine) => {
    const p = productsById[l.productId];
    return !l.unit || !p || l.unit === p.baseUnit
      ? 1
      : (p.packs || []).find((x) => x.unit === l.unit)?.factor || 1;
  };
  /** The line's GST rate as it will bill: the box, else the product's. */
  const rateOf = (l: DraftLine) => {
    if (!taxEnabled) return 0;
    const p = productsById[l.productId];
    return l.taxRate === "" ? p?.taxRatePct || 0 : Number(l.taxRate) || 0;
  };
  /** MRP per base unit: the selling lot's, else the product's. 0 = none known. */
  const mrpOf = (l: DraftLine) =>
    l.lotMrp && l.lotMrp > 0 ? l.lotMrp : productsById[l.productId]?.mrp || 0;

  /** What a blank price box bills: the product's price, held to the MRP. */
  const defaultPrice = (l: DraftLine) => {
    const factor = factorOf(l);
    const price = (productsById[l.productId]?.sellingPrice || 0) * factor;
    const mrp = mrpOf(l);
    return mrp > 0
      ? Math.min(price, maxUnitPrice(mrp, factor, rateOf(l), priceIncludesTax))
      : price;
  };

  /**
   * The server's MRP rule, at the box, so a price is refused while it can still
   * be corrected. Offline this is the ONLY check that can stop it: a queued bill
   * cannot be refused later.
   */
  const mrpIssue = (l: DraftLine): string | null => {
    const quantity = Number(l.quantity) || 0;
    const mrp = mrpOf(l);
    if (!quantity || !(mrp > 0) || l.unitPrice === "") return null;
    const factor = factorOf(l);
    const taxRate = rateOf(l);
    const over = aboveMrp({
      unitPrice: Number(l.unitPrice) || 0,
      quantity,
      baseQuantity: Math.round(quantity * factor * 1000) / 1000,
      mrpPerBase: mrp,
      taxRate,
      priceIncludesTax,
    });
    if (!over) return null;
    const unit = l.unit || l.baseUnit;
    const max = maxUnitPrice(mrp, factor, taxRate, priceIncludesTax);
    return `Above MRP ${fmtMoneyExact(mrp * factor)} per ${unit} — the most you can charge is ${fmtMoneyExact(max)}${
      priceIncludesTax ? "" : " + GST"
    }.`;
  };

  /** A changed rate has to be a real slab; the product's own always stands. */
  const gstIssue = (l: DraftLine): string | null => {
    if (!canEditGst || l.taxRate === "") return null;
    const rate = Number(l.taxRate);
    if (rate === (productsById[l.productId]?.taxRatePct || 0)) return null;
    return GST_SLABS.includes(rate)
      ? null
      : `GST must be ${GST_SLABS.join(", ")} or the product's own rate.`;
  };

  // Client-side preview (tax-exclusive). Backend computes authoritative totals.
  const calc = (l: DraftLine) => {
    const qty = Number(l.quantity) || 0;
    const unitPrice =
      l.unitPrice === "" ? defaultPrice(l) : Number(l.unitPrice) || 0;
    const gross = unitPrice * qty;
    const discountInput = Number(l.discount) || 0;
    // Same clamp the server applies, so the preview is what gets charged.
    const discount =
      l.discountMode === "pct"
        ? (gross * Math.min(Math.max(discountInput, 0), 100)) / 100
        : Math.min(Math.max(discountInput, 0), gross);
    const net = Math.max(gross - discount, 0);
    const rate = rateOf(l);
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
  const hasPriceIssue = lines.some((l) => mrpIssue(l) || gstIssue(l));
  // Checked here, offline too: a queued bill can't be refused later, and a
  // credit sale with no customer is a debt recorded against nobody.
  const creditNeedsCustomer = paymentMode === "credit" && !customerId;

  // Lines with a product but no quantity. They are dropped from the payload, so
  // they block the sale: a row on the counter is either billed or removed.
  const blankQtyLines = lines
    .map((l, i) => ({ i, name: l.productName }))
    .filter(({ i }) => lines[i].productId && !(Number(lines[i].quantity) > 0));

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
  /**
   * The exact figure, to the paisa — and the round-off shown separately.
   *
   * This used to be `Math.round(...)`, so ₹311.20 was displayed as ₹311 and the
   * 20 paise simply vanished: nothing on screen said where they went, which is
   * what made it an accounting discrepancy rather than a rounding convention.
   *
   * The server rounds too (sale.service.js: grandTotal = Math.round(rawGrand),
   * with a stored roundOff) because that is how a GST invoice settles — whole
   * rupees collected. So the fix is not to charge ₹311.20; it is to stop hiding
   * it. Exact total, explicit round-off, and the payable the customer hands
   * over — the same three lines the goods-received note already prints.
   */
  const exactTotal = Math.round((totals.taxable + totals.tax) * 100) / 100;
  const grand = Math.round(exactTotal);
  const roundOff = Math.round((grand - exactTotal) * 100) / 100;
  const itemCount = lines.length;
  /** The percent every line shares, or null when they differ. */
  const billDiscount = (() => {
    const pcts = lines.map((l) =>
      l.discountMode === "pct" ? Number(l.discount) || 0 : -1,
    );
    return pcts.length && pcts.every((p) => p === pcts[0]) ? pcts[0] : null;
  })();
  const applyBillDiscount = (pct: number) =>
    setLines((cur) =>
      cur.map((l) => ({
        ...l,
        discountMode: "pct",
        discount: pct ? String(pct) : "",
      })),
    );
  const qtyCount = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  // Sent values are clamped again here: the boxes bound what can be typed, this
  // bounds what can leave the screen, whatever route put the value there.
  const validLines: SaleLineInput[] = lines
    .filter((l) => l.productId && Number(l.quantity) > 0)
    .map((l) => ({
      productId: l.productId,
      batchId: l.batchId || undefined,
      unit: l.unit || undefined,
      quantity: Number(l.quantity),
      // A blank box normally leaves the price to the server. When the MRP has
      // already pulled it down, say so: an offline bill replays as charged.
      unitPrice:
        l.unitPrice === ""
          ? defaultPrice(l) <
            (productsById[l.productId]?.sellingPrice || 0) * factorOf(l)
            ? defaultPrice(l)
            : undefined
          : Math.max(Number(l.unitPrice) || 0, 0),
      discountAmount:
        l.discountMode === "amount" && l.discount !== ""
          ? Math.min(Math.max(Number(l.discount) || 0, 0), calc(l).gross)
          : undefined,
      discountPct:
        l.discountMode === "pct" && l.discount !== ""
          ? Math.min(Math.max(Number(l.discount) || 0, 0), 100)
          : undefined,
      taxRatePct:
        l.taxRate === ""
          ? undefined
          : Math.min(Math.max(Number(l.taxRate) || 0, 0), 100),
    }));

  // `!mut.isPending` belongs in canSubmit, not only on the button: the Ctrl+Enter
  // shortcut bypasses the disabled state and auto-repeats while held.
  /**
   * A bill that charges nothing has to be deliberate.
   *
   * A 100% discount is a legitimate thing to do — a replacement, a goodwill
   * pack — but it is also what a mis-keyed discount looks like, and the goods
   * leave either way. Acknowledging it costs one tap; giving stock away by
   * accident costs the shop.
   */
  const [ackFreeSale, setAckFreeSale] = useState(false);
  // The confirmation left on screen after a bill is captured offline.
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
  // Locally-priced document behind the notice's "Print bill" action.
  const [queuedSale, setQueuedSale] = useState<Sale | null>(null);
  // Set when a typed figure was rewritten to its ceiling; cleared on the next
  // edit that fits, so it reads as feedback rather than a stuck error.
  const [clampNote, setClampNote] = useState<string | null>(null);
  const isFreeSale = validLines.length > 0 && grand <= 0;
  // Adjusted during render, not in an effect — the same pattern the list
  // screens use to reset a page number when a filter changes. Once the total is
  // no longer zero the acknowledgement is stale and must not carry over.
  if (!isFreeSale && ackFreeSale) setAckFreeSale(false);

  const submitLock = useRef(false);
  /**
   * One id per bill, held until it succeeds, including across a reload: a retry
   * after a dropped reply is then the same bill to the server, not a second one.
   */
  const [opId, setOpId] = useState(genOpId);

  const user = useAuthStore((s) => s.user);
  const draftStoreKey = user ? draftKey(user.organizationId, user.id) : null;
  /** Nothing is saved until the stored draft has been read, or it gets erased. */
  const [draftChecked, setDraftChecked] = useState(false);
  const [restoredNote, setRestoredNote] = useState<string | null>(null);
  /** A restored bill waiting to be re-checked. */
  const [toRecheck, setToRecheck] = useState<{
    lines: DraftLine[];
    products: Record<string, ProductRow>;
  } | null>(null);

  const resetBill = () => {
    setLines([]);
    setCustomerId(null);
    setDoctorName("");
    setPrescriptionId(null);
    setPaymentMode("cash");
    setRefillDays("");
    setRestoredNote(null);
    setOpId(genOpId());
    if (draftStoreKey) void AsyncStorage.removeItem(draftStoreKey);
  };

  const canSubmit =
    validLines.length > 0 &&
    shortLines.length === 0 &&
    blankQtyLines.length === 0 &&
    !hasPriceIssue &&
    !creditNeedsCustomer &&
    (!isFreeSale || ackFreeSale) &&
    !mut.isPending;
  /**
   * Items the law says need a doctor's prescription: Schedule H / H1 / X or
   * flagged Rx. Judged from the product rows the screen already holds.
   */
  const rxItems = validLines
    .map((l) => knownProducts[l.productId])
    .filter(
      (p) =>
        Boolean(p) &&
        (p.prescriptionRequired ||
          ["H", "H1", "X"].includes(String(p.scheduleDrug || ""))),
    )
    .map((p) => p.name);

  const submit = (rxOverride?: string | null) => {
    // A ref, not state: two presses inside one render see the same `canSubmit`.
    if (!canSubmit || submitLock.current) return;
    setQueuedNotice(null);
    // Only a real id counts. Called straight from a button's onPress this
    // receives the press EVENT — a DOM element on web — which must never
    // reach the payload (it is circular and cannot be serialised).
    const rxId = typeof rxOverride === "string" ? rxOverride : prescriptionId;
    /**
     * Prescription gate: a live sale of a scheduled item stops here until a
     * prescription is on record. Offline, the bill goes through — the
     * server accepts a replayed offline bill with the doctor's name and the
     * register still gets its entry; the pharmacy can switch enforcement
     * off in Settings.
     */
    if (
      rxItems.length > 0 &&
      !rxId &&
      invoiceProfile?.rx?.enforce !== false &&
      useOfflineStore.getState().online
    ) {
      setRxPurpose("gate");
      setRxGateOpen(true);
      return;
    }
    submitLock.current = true;
    mut.mutate(
      {
        clientOpId: opId,
        customerId,
        doctorName: doctorName.trim() || undefined,
        prescriptionId: rxId || undefined,
        taxType,
        paymentMode: paymentMode as never,
        lines: validLines,
      },
      {
        onSettled: () => {
          submitLock.current = false;
        },
        onSuccess: (sale) => {
          // The Sales stack keeps this screen mounted, so clear the cart after a
          // sale or the next customer inherits it. `lines`/`validLines` used
          // below are captured render values and stay valid after this reset.
          resetBill();
          /**
           * Captured offline: there is no server sale to open, so stay here,
           * ready for the next customer, and say what was promised — the bill
           * number the drain will honour. Printing the queued bill arrives
           * with the local sale store (Phase 2).
           */
          if ("queued" in sale) {
            setQueuedNotice(
              sale.displayNo
                ? `Bill ${sale.displayNo} saved offline — it will sync when the connection returns.`
                : "Bill saved offline — it will be numbered and synced when the connection returns.",
            );
            setQueuedSale(sale.printableSale);
            focusSearch();
            return;
          }
          setQueuedNotice(null);
          setQueuedSale(null);
          /**
           * Offer a refill call before leaving the screen.
           *
           * A 20-day course runs out on a knowable date, and the pharmacy that
           * rings first keeps the repeat. The days come from the base units
           * sold — one unit a day is the ordinary dosing assumption — and the
           * pharmacist can change the date before saving, because plenty of
           * medicines aren't once-daily.
           */
          // The picker wins when it was used; "off" skips the offer entirely.
          const inferred = Math.round(
            validLines.reduce((t, l) => t + (Number(l.quantity) || 0), 0),
          );
          const days =
            refillDays && refillDays !== "off" ? Number(refillDays) : inferred;
          const wanted =
            refillDays !== "off" && (refillDays ? days > 0 : days >= 3);
          if (customerId && wanted) {
            setFollowUp({
              saleId: sale.id,
              days,
              customerName: selectedCustomer?.name || "the customer",
              customerId,
              mobile: selectedCustomer?.mobile || "",
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
    if (!isFocused) return;
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen()) return;
      if (e.key === "F2") {
        e.preventDefault();
        focusSearch();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        // Stopped here, or a payment chip with focus takes this Enter as a press.
        e.stopPropagation();
        if (handlersRef.current.canSubmit) handlersRef.current.submit();
      }
    };
    // Capture: Pressable stops the keydown of a focused chip from bubbling.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isFocused]);

  // Coming back from an invoice, the next bill starts with the search ready.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(focusSearch, 60);
      return () => clearTimeout(t);
    }, []),
  );

  // ---- Unfinished bill -----------------------------------------------------
  /** Stored prices are a snapshot: bring them and the stock up to date. */
  const recheckDraft = async (
    restored: DraftLine[],
    stored: Record<string, ProductRow>,
  ) => {
    const ids = [...new Set(restored.map((l) => l.productId))];
    const fresh = await Promise.all(
      ids.map(async (id) => {
        try {
          return (await productApi.get(id)) as unknown as ProductRow;
        } catch (e) {
          // Deleted since: the line stays, marked unsellable, for a person to
          // remove. Any other failure keeps the snapshot.
          const status = (e as { response?: { status?: number } })?.response
            ?.status;
          if (status === 404) {
            setLines((cur) =>
              cur.map((l) => (l.productId === id ? { ...l, available: 0 } : l)),
            );
          }
          return null;
        }
      }),
    );
    let repriced = 0;
    for (const p of fresh) {
      if (!p) continue;
      const old = stored[p.id] ?? p;
      setKnownProducts((cur) => ({ ...cur, [p.id]: p }));
      const found = await fetchAvailability(p.id);
      if (!found) continue;
      // A price the cashier typed stands; only one still on the default moves.
      repriced += restored.filter(
        (l) =>
          l.productId === p.id &&
          !l.batchId &&
          Math.abs(
            Number(l.unitPrice) -
              Number(priceForUnit(p.id, l.unit, l.lotMrp, old)),
          ) < 0.01 &&
          Math.abs(
            Number(l.unitPrice) -
              Number(priceForUnit(p.id, l.unit, found.lotMrp, p)),
          ) >= 0.01,
      ).length;
      applyAvailability(p.id, found, p, old);
    }
    if (repriced > 0) {
      setRestoredNote(
        `Restored unfinished bill · ${repriced} price${repriced === 1 ? "" : "s"} updated`,
      );
    }
  };

  // Read once per signed-in user.
  useEffect(() => {
    if (!draftStoreKey || draftChecked) return;
    let dead = false;
    void AsyncStorage.getItem(draftStoreKey)
      .catch(() => null)
      .then((raw) => {
        if (dead) return;
        const d = parseDraft<DraftLine, ProductRow, CustomerRow>(raw);
        setDraftChecked(true);
        if (!d) return;
        setKnownProducts((cur) => ({ ...d.products, ...cur }));
        if (d.customer) {
          const c = d.customer;
          setKnownCustomers((cur) => ({ ...cur, [c.id]: c }));
        }
        setCustomerId(d.customerId);
        setDoctorName(d.doctorName);
        setPrescriptionId(d.prescriptionId);
        setTaxType(d.taxType);
        setPaymentMode(d.paymentMode);
        setRefillDays(d.refillDays);
        setOpId(d.opId);
        setLines(d.lines);
        setRestoredNote("Restored unfinished bill");
        setToRecheck({ lines: d.lines, products: d.products });
      });
    return () => {
      dead = true;
    };
  }, [draftStoreKey, draftChecked]);

  // Held for the shop's tax settings: priced without them, every restored line
  // looks hand-typed, because its default comes out ex-GST.
  useEffect(() => {
    if (!toRecheck || !profileSettled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hand-off
    setToRecheck(null);
    void recheckDraft(toRecheck.lines, toRecheck.products);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per restore
  }, [toRecheck, profileSettled]);

  // Written on every change, not debounced: the refresh that loses a bill gives
  // no warning, and this is under a kilobyte per line.
  useEffect(() => {
    if (!draftStoreKey || !draftChecked) return;
    if (lines.length === 0) {
      void AsyncStorage.removeItem(draftStoreKey);
      return;
    }
    const products: Record<string, ProductRow> = {};
    for (const l of lines) {
      const p = productsById[l.productId];
      if (p) products[l.productId] = p;
    }
    void AsyncStorage.setItem(
      draftStoreKey,
      serializeDraft({
        opId,
        lines,
        products,
        customerId,
        customer: selectedCustomer ?? null,
        doctorName,
        prescriptionId,
        taxType,
        paymentMode,
        refillDays,
      }),
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the bill's own fields
  }, [
    lines,
    customerId,
    doctorName,
    prescriptionId,
    taxType,
    paymentMode,
    refillDays,
    opId,
    draftStoreKey,
    draftChecked,
  ]);

  // The draft survives anything; this only stops a stray Back mid-sale. Electron
  // skips it, because there a blocked unload closes nothing and asks nothing.
  const hasItems = lines.length > 0;
  useEffect(() => {
    if (!hasItems || Platform.OS !== "web" || typeof window === "undefined")
      return;
    if (/Electron/i.test(navigator.userAgent)) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasItems]);

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
      onSubmitRaw={queueScan}
      onRawMiss={reportScanMiss}
      leading={<Search size={18} color={palette.teal[600]} strokeWidth={2} />}
      emptyText="No medicine matches — try a salt name, or scan the pack"
    />
  );

  /** Enter returns to the search; the arrows walk the column of Qty boxes. */
  const qtyKeys = (i: number) => ({
    nativeID: `pos-qty-${i}`,
    onEnter: focusSearch,
    onArrow: (dir: 1 | -1) => focusQty(i + dir),
  });

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
          <HeadCell w={COL.disc} label="DISC" />
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
                        {/* One line, always: a cart that wraps here costs a
                            whole bill's height. Stock and the two actions come
                            first; the salt takes what is left and truncates. */}
                        <HStack gap={6} align="center" style={styles.metaRow}>
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
                              tabIndex={-1}
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
                          <ShortbookChip
                            busy={shortbookBusy === line.productId}
                            onPress={() =>
                              void addToShortbook(line, shortbookQty(line))
                            }
                          />
                          {line.salt ? (
                            <Text
                              variant="caption"
                              tone="tertiary"
                              numberOfLines={1}
                              style={{ flex: 1, minWidth: 0 }}
                            >
                              {line.salt}
                            </Text>
                          ) : null}
                        </HStack>
                      </View>
                      <Cell
                        w={COL.qty}
                        value={line.quantity}
                        onChangeText={(v) => setLine(i, { quantity: v })}
                        error={!!issue}
                        align="center"
                        label={`Quantity of ${line.productName}`}
                        {...qtyKeys(i)}
                      />
                      <View style={{ width: COL.unit }}>
                        <Select
                          compact
                          value={line.unit}
                          options={unitOptions(line)}
                          onChange={(v) =>
                            setLine(i, {
                              unit: v,
                              unitPrice: priceForUnit(
                                line.productId,
                                v,
                                line.lotMrp,
                              ),
                            })
                          }
                        />
                      </View>
                      <Cell
                        w={COL.price}
                        value={line.unitPrice}
                        onChangeText={(v) => setLine(i, { unitPrice: v })}
                        error={!!mrpIssue(line)}
                        label={`Price of ${line.productName}`}
                      />
                      <DiscCell
                        w={COL.disc}
                        line={line}
                        gross={c.gross}
                        onValue={(v) => setLine(i, { discount: v })}
                        onMode={(m) => setLine(i, { discountMode: m })}
                        onNote={setClampNote}
                        offTabPath
                      />
                      <Cell
                        w={COL.gst}
                        value={taxEnabled ? line.taxRate : "0"}
                        max={100}
                        onChangeText={(v) => setLine(i, { taxRate: v })}
                        align="center"
                        error={!!gstIssue(line)}
                        editable={canEditGst}
                        offTabPath
                        label={`GST percent of ${line.productName}`}
                      />
                      <Text
                        variant="label"
                        tone="primary"
                        style={{ width: COL.amount, textAlign: "right" }}
                      >
                        {fmtMoneyExact(c.total)}
                      </Text>
                      <Pressable
                        onPress={() => removeLine(i)}
                        hitSlop={8}
                        tabIndex={-1}
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
                    {mrpIssue(line) || gstIssue(line) ? (
                      <Text
                        variant="caption"
                        tone="danger"
                        style={{ textAlign: "right", marginTop: 4 }}
                      >
                        {mrpIssue(line) || gstIssue(line)}
                      </Text>
                    ) : null}
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
                      <ShortbookChip
                        busy={shortbookBusy === line.productId}
                        onPress={() =>
                          void addToShortbook(line, shortbookQty(line))
                        }
                      />
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
                          {...qtyKeys(i)}
                        />
                      </Field>
                      <Field label="Unit" w={104}>
                        <Select
                          value={line.unit}
                          options={unitOptions(line)}
                          onChange={(v) =>
                            setLine(i, {
                              unit: v,
                              unitPrice: priceForUnit(
                                line.productId,
                                v,
                                line.lotMrp,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field label="Price" w={84}>
                        <Cell
                          w={84}
                          value={line.unitPrice}
                          onChangeText={(v) => setLine(i, { unitPrice: v })}
                          error={!!mrpIssue(line)}
                        />
                      </Field>
                      <Field label="Disc" w={120}>
                        <DiscCell
                          w={120}
                          line={line}
                          gross={c.gross}
                          onValue={(v) => setLine(i, { discount: v })}
                          onMode={(m) => setLine(i, { discountMode: m })}
                          onNote={setClampNote}
                        />
                      </Field>
                      <Field label="GST%" w={56}>
                        <Cell
                          w={56}
                          value={taxEnabled ? line.taxRate : "0"}
                          max={100}
                          onChangeText={(v) => setLine(i, { taxRate: v })}
                          align="center"
                          error={!!gstIssue(line)}
                          editable={canEditGst}
                        />
                      </Field>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text variant="caption" tone="tertiary">
                          Amount
                        </Text>
                        <Text variant="label-lg" tone="primary">
                          {fmtMoneyExact(c.total)}
                        </Text>
                      </View>
                    </HStack>
                    {mrpIssue(line) || gstIssue(line) ? (
                      <Text
                        variant="caption"
                        tone="danger"
                        style={{ marginTop: 6 }}
                      >
                        {mrpIssue(line) || gstIssue(line)}
                      </Text>
                    ) : null}
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
    <Card style={{ marginBottom: 10 }}>
      <VStack gap={12}>
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
          /* Not `onCreate`: that makes a customer from a name alone, and the
             mobile number is the half that matters at a till — it is where the
             refill reminder goes and how they are found next visit. */
          onRequestCreate={(query) => {
            setNewCustomerName(query);
            setNewCustomerError(null);
            setNewCustomerOpen(true);
          }}
          createNoun="customer"
          allowClear
        />
        <TextField
          label="Doctor (optional)"
          placeholder="Prescribing doctor — prints as Doct: on the bill"
          value={doctorName}
          onChangeText={setDoctorName}
          autoCapitalize="words"
        />

        {/*
          Attach the paper prescription to ANY sale, not only a scheduled one.
          The capture sheet already existed but was reachable only when the law
          forced it open; a pharmacist who simply wants the script on file for a
          repeat customer had nowhere to put it.
        */}
        {prescriptionId ? (
          <HStack gap={8} align="center">
            <Paperclip size={16} color={palette.success.text} strokeWidth={2} />
            <Text variant="body-sm" tone="success" style={{ flex: 1 }}>
              Prescription attached
            </Text>
            <Pressable
              onPress={() => {
                setRxPurpose("attach");
                setRxGateOpen(true);
              }}
              hitSlop={6}
              accessibilityLabel="Replace the attached prescription"
            >
              <Text variant="label-sm" tone="link">
                Replace
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPrescriptionId(null)}
              hitSlop={6}
              accessibilityLabel="Remove the attached prescription"
            >
              <Text variant="label-sm" tone="tertiary">
                Remove
              </Text>
            </Pressable>
          </HStack>
        ) : (
          <Button
            label="Attach prescription photo"
            variant="secondary"
            size="sm"
            icon={
              <Camera
                size={16}
                color={palette.text.primary}
                strokeWidth={1.9}
              />
            }
            onPress={() => {
              setRxPurpose("attach");
              setRxGateOpen(true);
            }}
          />
        )}
        {/* Only once a customer is named — there is nobody to ring back on a
            walk-in sale, so the control would just be noise. */}
        {customerId ? (
          <View>
            <Text variant="caption" tone="tertiary" style={{ marginBottom: 4 }}>
              Refill reminder
            </Text>
            <ChipsRow
              chips={[
                { key: "", label: "Auto" },
                { key: "7", label: "7 days" },
                { key: "10", label: "10 days" },
                { key: "15", label: "15 days" },
                { key: "30", label: "30 days" },
                { key: "off", label: "No reminder" },
              ]}
              active={refillDays}
              onChange={setRefillDays}
            />
            <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
              {refillDays === "off"
                ? "No call will be scheduled."
                : refillDays
                  ? `Call ${selectedCustomer?.name || "the customer"} in ${Math.max(1, Number(refillDays) - REFILL_LEAD_DAYS)} days — ${REFILL_LEAD_DAYS} days before a ${refillDays}-day course runs out.`
                  : `Worked out from the quantity sold, ${REFILL_LEAD_DAYS} days before it runs out. Pick a course length to override.`}
            </Text>
          </View>
        ) : null}
        <View>
          <Text variant="caption" tone="tertiary" style={{ marginBottom: 4 }}>
            GST type
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
          <Text variant="caption" tone="tertiary" style={{ marginBottom: 4 }}>
            Payment
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
          {creditNeedsCustomer ? (
            <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
              Credit needs a customer — choose one above, so the amount owed is
              recorded against them.
            </Text>
          ) : null}
        </View>
      </VStack>
    </Card>
  );

  const totalsCard = (
    <Card style={{ marginBottom: 10 }}>
      <VStack gap={6}>
        <Row
          label={`Subtotal · ${itemCount} item${itemCount === 1 ? "" : "s"}`}
          value={fmtMoneyExact(totals.subtotal)}
        />
        {itemCount > 0 ? (
          <VStack gap={4}>
            <Text variant="caption" tone="tertiary">
              Discount on all items
            </Text>
            <HStack gap={6} align="center" wrap>
              {[0, ...DISCOUNT_PRESETS].map((pct) => {
                const on = billDiscount === pct;
                return (
                  <Pressable
                    key={pct}
                    onPress={() => applyBillDiscount(pct)}
                    style={[styles.discChip, on && styles.discOptionOn]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      pct ? `${pct} percent off every item` : "No discount"
                    }
                  >
                    <Text
                      variant="label-sm"
                      style={{ color: on ? "#FFFFFF" : palette.text.secondary }}
                    >
                      {pct ? `${pct}%` : "None"}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </VStack>
        ) : null}
        {totals.discount > 0 && (
          <Row label="Discount" value={`- ${fmtMoneyExact(totals.discount)}`} />
        )}
        <Row label="Taxable" value={fmtMoneyExact(totals.taxable)} />
        {taxType === "intra" ? (
          <>
            <Row label="CGST" value={fmtMoneyExact(totals.tax / 2)} muted />
            <Row
              label="SGST"
              value={fmtMoneyExact(
                totals.tax - Math.round((totals.tax / 2) * 100) / 100,
              )}
              muted
            />
          </>
        ) : (
          <Row label="IGST" value={fmtMoneyExact(totals.tax)} muted />
        )}
        {/* The exact figure and the round-off, both stated. Showing only the
            rounded total made 20 paise disappear with nothing to account for
            them — the discrepancy the audit reported. */}
        <Row label="Total amt" value={fmtMoneyExact(exactTotal)} />
        {roundOff !== 0 ? (
          <Row
            label="Round off"
            value={`${roundOff > 0 ? "+" : "−"}${fmtMoneyExact(Math.abs(roundOff))}`}
            muted
          />
        ) : null}
        <View style={styles.divider} />
        <HStack justify="space-between" align="center">
          <Text variant="h3" tone="primary">
            To pay
          </Text>
          <Text variant="display-sm" tone="accent">
            {fmtMoney(grand)}
          </Text>
        </HStack>
        <Text variant="caption" tone="tertiary">
          {qtyCount} unit{qtyCount === 1 ? "" : "s"} · final GST is worked out
          when the bill is saved
        </Text>
      </VStack>
    </Card>
  );

  const rail = (
    <View style={railSide ? [styles.rail, stickyStyle] : undefined}>
      {configCard}
      {totalsCard}
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
      {blankQtyLines.length > 0 ? (
        <Banner
          tone="warning"
          title="Enter a quantity, or remove the line"
          style={{ marginBottom: 12 }}
        >
          {blankQtyLines.map(({ i, name }) => (
            <Text key={i} variant="caption" tone="warning">
              {name || `Line ${i + 1}`}: no quantity — it will not be billed
            </Text>
          ))}
        </Banner>
      ) : null}
      {clampNote ? (
        <Banner tone="info" message={clampNote} style={{ marginBottom: 12 }} />
      ) : null}
      <RxGateModal
        visible={rxGateOpen}
        customerId={customerId}
        customerName={selectedCustomer?.name}
        rxItems={rxItems}
        doctorName={doctorName}
        mode={rxPurpose === "attach" ? "optional" : "required"}
        onDone={(id, doc) => {
          setPrescriptionId(id);
          if (doc) setDoctorName(doc);
          setRxGateOpen(false);
          // Only the gate was mid-sale. A voluntary attach returns to the cart,
          // which may not even have items in it yet.
          if (rxPurpose === "gate") submit(id);
        }}
        onCancel={() => setRxGateOpen(false)}
      />
      {prescriptionId ? (
        <Banner
          tone="success"
          message={
            rxItems.length > 0
              ? "Prescription attached — this sale goes into the Schedule H register."
              : "Prescription attached to this bill."
          }
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {queuedNotice ? (
        <Banner tone="info" message={queuedNotice} style={{ marginBottom: 12 }}>
          {queuedSale ? (
            <Pressable
              onPress={() => void printInvoice(queuedSale, invoiceProfile)}
              style={{ marginTop: 6 }}
            >
              <Text variant="label-sm" tone="link">
                Print bill
              </Text>
            </Pressable>
          ) : null}
        </Banner>
      ) : null}
    </View>
  );

  /** First reason the bill can't go, in plain words, beside the button. */
  const blocker = saleBlocker({
    itemCount: lines.length,
    blankQtyName: blankQtyLines[0]?.name,
    shortName: shortLines[0] ? lines[shortLines[0].i].productName : null,
    priceIssue: lines.map((l) => mrpIssue(l) || gstIssue(l)).find(Boolean),
    creditNeedsCustomer,
  });

  /**
   * Pinned below the page, because the rail is taller than a 768px screen: with
   * one item in the cart Complete sale sat under the fold, and its errors above
   * it were off-screen too. The total, the reason and the button are always here.
   */
  const footer = (
    <View
      style={[
        styles.footer,
        // The phone's tab bar floats over the bottom of the screen.
        width < layout.wideBreakpoint && { paddingBottom: tabClearance },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {blocker ? (
          <Text variant="caption" tone="danger" numberOfLines={2}>
            {blocker}
          </Text>
        ) : isFreeSale ? (
          <Pressable
            onPress={() => setAckFreeSale((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ackFreeSale }}
            style={styles.freeAck}
          >
            <View
              style={[
                freeSaleBox,
                ackFreeSale && {
                  backgroundColor: palette.warning.text,
                  borderColor: palette.warning.text,
                },
              ]}
            />
            <Text variant="caption" tone="warning" style={{ flex: 1 }}>
              This bill charges nothing and the stock still leaves the shelf.
              Give these items free
            </Text>
          </Pressable>
        ) : mut.isError ? (
          <Text variant="caption" tone="danger" numberOfLines={2}>
            {apiErrorMessage(mut.error)}
          </Text>
        ) : null}
      </View>
      {wide ? (
        <HStack gap={12} align="center">
          <KeyHint k="F2" label="Search" />
          <KeyHint k="Ctrl ↵" label="Complete" />
        </HStack>
      ) : null}
      <VStack gap={0} style={{ alignItems: "flex-end" }}>
        <Text variant="caption" tone="tertiary">
          To pay
        </Text>
        <Text variant="label-lg" tone="accent">
          {fmtMoney(grand)}
        </Text>
      </VStack>
      <Button
        label="Complete sale"
        size="md"
        fullWidth={false}
        loading={mut.isPending}
        disabled={!canSubmit}
        onPress={() => submit()}
        icon={<ShoppingCart size={16} color="#FFFFFF" strokeWidth={2} />}
      />
    </View>
  );

  return (
    <Screen
      overline="Sales"
      title="New sale"
      subtitle="Scan or search · FEFO auto-picks nearest-expiry batches"
      overlay={footer}
      right={
        /* Wraps because these four do not fit one phone-width line: unwrapped,
           the last button sat past the right edge and the whole billing screen
           panned sideways to reach it, clipping the search and totals. */
        <HStack gap={8} wrap>
          {/* A counter that can't silence the beeps ends up with the machine
              volume down, which kills the error tone too. */}
          <Button
            label={soundOff ? "Sound off" : "Sound on"}
            variant="secondary"
            size="sm"
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
            size="sm"
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
            size="sm"
            fullWidth={false}
            icon={
              <ScanText
                size={16}
                color={palette.text.primary}
                strokeWidth={2}
              />
            }
            onPress={() => void openPackScanner()}
          />
          <Button
            label="Invoices"
            variant="secondary"
            size="sm"
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
          {/* Sticks, so a long bill can't scroll the box the gun types into. */}
          <View style={[styles.searchBar, searchStickyStyle]}>
            {addBar}
            {scanError ? (
              <Text variant="caption" tone="danger" style={{ marginTop: 4 }}>
                {scanError}
              </Text>
            ) : null}
            {restoredNote ? (
              <HStack gap={6} align="center" style={{ marginTop: 4 }}>
                <Text variant="caption" tone="tertiary">
                  {restoredNote} ·
                </Text>
                <Pressable
                  onPress={resetBill}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Clear the restored bill"
                >
                  <Text variant="caption" tone="link">
                    Clear
                  </Text>
                </Pressable>
              </HStack>
            ) : null}
          </View>
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
      <NewCustomerDialog
        visible={newCustomerOpen}
        initialName={newCustomerName}
        loading={createCustomer.isPending}
        error={newCustomerError}
        onSubmit={createCustomerWithMobile}
        onCancel={() => setNewCustomerOpen(false)}
      />

      <ConfirmDialog
        visible={Boolean(followUp)}
        title="Set a refill reminder?"
        message={
          followUp
            ? `Call ${followUp.customerName}${followUp.medicine ? ` about ${followUp.medicine}` : ""} in ${followUp.days} ${followUp.days === 1 ? "day" : "days"}, when the course runs out?`
            : ""
        }
        confirmLabel={`Remind me in ${followUp?.days ?? 0} days`}
        cancelLabel="No thanks"
        loading={createReminder.isPending}
        onConfirm={() => {
          if (!followUp) return;
          const due = new Date();
          due.setDate(
            due.getDate() + Math.max(1, followUp.days - REFILL_LEAD_DAYS),
          );
          due.setHours(10, 0, 0, 0);
          createReminder.mutate(
            {
              title: `Refill call — ${followUp.customerName}${followUp.medicine ? ` · ${followUp.medicine}` : ""}`,
              notes: `Course of ${followUp.days} units sold on ${fmtDate(new Date())}.`,
              dueAt: due.toISOString(),
              priority: "normal",
              // The number travels as data, so Reminders can dial it.
              customerId: followUp.customerId,
              customerName: followUp.customerName,
              customerMobile: followUp.mobile,
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
      {aiConsentDialog}
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
      tabIndex={-1}
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
                  {alt.available} in stock · {fmtMoneyExact(alt.sellingPrice)}/
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
 * Sized to what these hold, so one row fits a 1366 screen beside the totals rail
 * and still leaves the name around 250px.
 */
const COL = {
  qty: 52,
  unit: 86,
  price: 68,
  disc: 62,
  gst: 44,
  amount: 76,
  rm: 22,
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
  max = Number.MAX_SAFE_INTEGER,
  editable = true,
  offTabPath,
  label,
  nativeID,
  onEnter,
  onArrow,
}: {
  w: number;
  value: string;
  onChangeText: (v: string) => void;
  align?: "left" | "center" | "right";
  error?: boolean;
  /** Server-side ceiling for this field; negatives are always refused. */
  max?: number;
  editable?: boolean;
  /** Stays clickable, but Tab passes over it: qty, unit, price, next line. */
  offTabPath?: boolean;
  label?: string;
  nativeID?: string;
  onEnter?: () => void;
  onArrow?: (dir: 1 | -1) => void;
}) {
  return (
    <TextInput
      nativeID={nativeID}
      value={value}
      onChangeText={(v) => onChangeText(clampInput(sanitizeDecimal(v), max))}
      keyboardType="decimal-pad"
      selectTextOnFocus
      editable={editable}
      focusable={offTabPath ? false : undefined}
      accessibilityLabel={label}
      blurOnSubmit={onEnter ? false : undefined}
      onKeyPress={(e) => {
        const { key, ctrlKey } = e.nativeEvent as unknown as {
          key: string;
          ctrlKey?: boolean;
        };
        if (key === "Enter" && !ctrlKey) onEnter?.();
        else if (onArrow && (key === "ArrowDown" || key === "ArrowUp")) {
          e.preventDefault();
          onArrow(key === "ArrowDown" ? 1 : -1);
        }
      }}
      style={[
        styles.cell,
        { width: w, textAlign: align },
        !editable && {
          color: palette.text.tertiary,
          backgroundColor: palette.ink[50],
        },
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

/** The quick picks behind every discount box, and the bill-wide row. */
const DISCOUNT_PRESETS = [10, 15, 20];

/**
 * Discount, in percent only. The ₹ option confused counter staff — a patient
 * asks for "10 percent", nobody asks for "₹14.30" — so the box takes a percent
 * and the ▾ beside it offers the usual 10 / 15 / 20.
 *
 * A line restored from an older draft may still be in rupees; it keeps its
 * value, and picking a preset or typing moves it to percent.
 */
function DiscCell({
  w,
  line,
  onValue,
  onMode,
  onNote,
  offTabPath,
}: {
  w: number;
  line: DraftLine;
  /** The line's gross — kept for callers; percent needs no ceiling but 100. */
  gross?: number;
  onValue: (v: string) => void;
  onMode: (m: "amount" | "pct") => void;
  /** Reports a rewritten value so the screen can say what it changed. */
  onNote: (note: string | null) => void;
  offTabPath?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pick = (pct: number) => {
    onValue(pct ? String(pct) : "");
    onMode("pct");
    onNote(null);
    setOpen(false);
  };
  return (
    <View style={[styles.discWrap, { width: w }]}>
      <TextInput
        value={line.discount}
        onChangeText={(v) => {
          const r = clampWithNote(sanitizeDecimal(v), 100, "Discount %");
          onValue(r.value);
          onNote(r.note);
          if (line.discountMode !== "pct") onMode("pct");
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={palette.text.tertiary}
        selectTextOnFocus
        focusable={offTabPath ? false : undefined}
        accessibilityLabel="Discount percent"
        // @ts-expect-error web-only outline reset
        style={[styles.discInput, { outlineStyle: "none" }]}
      />
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.discPick}
        tabIndex={offTabPath ? -1 : undefined}
        accessibilityRole="button"
        accessibilityLabel="Choose a discount"
      >
        <Text variant="label-sm" tone="tertiary">
          {line.discountMode === "amount" ? "₹" : "%"}
        </Text>
        <ChevronDown size={12} color={palette.text.tertiary} strokeWidth={2} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.discBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.discMenu}>
            <Text variant="label" tone="primary" style={{ marginBottom: 6 }}>
              Discount
            </Text>
            {[0, ...DISCOUNT_PRESETS].map((pct) => {
              const on =
                line.discountMode === "pct" &&
                (Number(line.discount) || 0) === pct;
              return (
                <Pressable
                  key={pct}
                  onPress={() => pick(pct)}
                  style={[styles.discOption, on && styles.discOptionOn]}
                  accessibilityRole="button"
                >
                  <Text
                    variant="body"
                    style={{ color: on ? "#FFFFFF" : palette.text.primary }}
                  >
                    {pct ? `${pct}%` : "No discount"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
const searchStickyStyle =
  Platform.OS === "web" ? ({ position: "sticky", top: 0 } as never) : undefined;

const styles = StyleSheet.create({
  rail: {},
  searchBar: {
    zIndex: 30,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: palette.surface.secondary,
  },
  metaRow: { marginTop: 1, overflow: "hidden" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
    backgroundColor: palette.surface.primary,
  },
  freeAck: { flexDirection: "row", alignItems: "center", gap: 8 },
  gridHead: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.default,
  },
  gridRow: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    height: 32,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    fontSize: 13,
    color: palette.text.primary,
    backgroundColor: palette.surface.primary,
  },
  discWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
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
    height: 30,
    paddingHorizontal: 4,
    fontSize: 13,
    color: palette.text.primary,
  },
  discChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  discPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    height: 30,
    paddingHorizontal: 3,
    borderLeftWidth: 1,
    borderLeftColor: palette.border.default,
  },
  discBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  discMenu: {
    width: 220,
    padding: 12,
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: palette.surface.primary,
  },
  discOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  discOptionOn: {
    backgroundColor: palette.teal[700],
    borderColor: palette.teal[700],
  },
  lotBadge: {
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: radius.full,
    backgroundColor: palette.teal[50],
  },
  fefoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 0,
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

const freeSaleBox = {
  width: 16,
  height: 16,
  borderRadius: radius.xs,
  borderWidth: 1.5,
  borderColor: palette.warning.text,
} as const;
