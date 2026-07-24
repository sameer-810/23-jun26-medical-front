import React, { useMemo, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Plus,
  X,
  History,
  ShoppingCart,
  ScanLine,
  AlertTriangle,
} from "lucide-react-native";
import { useProducts } from "@modules/product/hooks/useProducts";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { useScanGun } from "@shared/useScanGun";
import {
  useCustomers,
  useCreateCustomer,
} from "@modules/customer/hooks/useCustomers";
import { useCreateSale } from "@modules/sale/hooks/useSales";
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
  TextField,
  Select,
  ChipsRow,
} from "@shared/ui";

interface DraftLine {
  productId: string | null;
  /** Set when the line came from a scanned label — pins the sale to this lot. */
  batchId?: string | null;
  batchNumber?: string | null;
  expiry?: string | null;
  /**
   * Sellable BASE units behind this line — the scanned lot's stock, or the
   * product's total when FEFO will choose. Lets the form say "only 3 left"
   * while the cashier types, instead of failing at checkout.
   */
  available?: number | null;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  /** Whether `discount` is a flat ₹ amount or a % of the line's gross. */
  discountMode: "amount" | "pct";
  taxRate: string;
}
const emptyLine = (): DraftLine => ({
  productId: null,
  batchId: null,
  batchNumber: null,
  expiry: null,
  available: null,
  unit: null,
  quantity: "1",
  unitPrice: "",
  discount: "",
  discountMode: "amount",
  taxRate: "",
});

/** "2028-01-31" / ISO -> "Jan 2028" for a quick human read on a line. */
const prettyExp = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m] = String(iso).slice(0, 10).split("-");
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${months[Number(m) - 1] || m} ${y}`;
};
const money = (n: number) =>
  `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;

export default function NewSaleScreen() {
  const navigation = useNavigation<any>();
  // Catalogue and customer list are both paged — the pickers search server-side
  // and we cache what's been resolved. Without the cache a product outside the
  // current results loses its price and the line total silently computes to ₹0.
  const [productQuery, setProductQuery] = useState("");
  const { data: products, isFetching: productsLoading } = useProducts({
    search: productQuery || undefined,
    limit: 50,
  });
  const [customerQuery, setCustomerQuery] = useState("");
  const { data: customers, isFetching: customersLoading } = useCustomers({
    search: customerQuery || undefined,
  });
  const createCustomer = useCreateCustomer();
  const mut = useCreateSale();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [taxType, setTaxType] = useState<"intra" | "inter">("intra");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  type ProductRow = NonNullable<typeof products>["data"][number];
  type CustomerRow = NonNullable<typeof customers>["data"][number];
  const [knownProducts, setKnownProducts] = useState<
    Record<string, ProductRow>
  >({});
  const [knownCustomers, setKnownCustomers] = useState<
    Record<string, CustomerRow>
  >({});

  /** Cache + live results — this is what the pricing maths reads from. */
  const productsById = useMemo(() => {
    const map: Record<string, ProductRow> = { ...knownProducts };
    for (const p of products?.data || []) map[p.id] = p;
    return map;
  }, [products, knownProducts]);

  /** Pickers list search results only; the catalogue is far too big to list. */
  // Show the salt too: a search for "pantoprazole" returns brand names, and the
  // molecule is what tells you why each one matched.
  const productOptions = (products?.data || []).map((p) => ({
    value: p.id,
    label: p.saltComposition
      ? `${p.name} · ${money(p.sellingPrice)}/${p.baseUnit} — ${p.saltComposition}`
      : `${p.name} · ${money(p.sellingPrice)}/${p.baseUnit}`,
  }));
  const customerOptions = (customers?.data || []).map((c) => ({
    value: c.id,
    label: c.mobile ? `${c.name} · ${c.mobile}` : c.name,
  }));

  const selectedCustomer = customerId
    ? knownCustomers[customerId] ||
      (customers?.data || []).find((c) => c.id === customerId)
    : null;

  /** Remember each pick so its label/price survives the next search. */
  const pickCustomer = (id: string | null) => {
    const c = id ? (customers?.data || []).find((x) => x.id === id) : null;
    if (c) setKnownCustomers((cur) => ({ ...cur, [c.id]: c }));
    setCustomerId(id);
  };

  const unitOptions = (productId: string | null) => {
    const p = productId ? productsById[productId] : null;
    if (!p) return [];
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
  const addLine = () => setLines((cur) => [...cur, emptyLine()]);

  /**
   * How many units of a hand-picked product can actually be sold. Scanned lines
   * already know (the scan says so); a dropdown pick has to ask.
   */
  const loadAvailability = async (index: number, productId: string) => {
    try {
      const inv = await inventoryApi.productInventory(productId);
      setLines((cur) =>
        cur.map((l, k) =>
          // Only if this line still holds the product we asked about — a slow
          // reply must never overwrite a line the cashier has moved on from.
          k === index && l.productId === productId
            ? { ...l, available: inv.summary.available }
            : l,
        ),
      );
    } catch {
      // Non-fatal: checkout still refuses to oversell, server-side.
    }
  };

  /** Drop a resolved line into the first blank slot, else append. */
  const placeLine = (line: DraftLine) =>
    setLines((cur) => {
      const blank = cur.findIndex((l) => !l.productId);
      return blank >= 0
        ? cur.map((l, k) => (k === blank ? line : l))
        : [...cur, line];
    });

  /**
   * A scanned barcode/QR from the counter's scanner (which types the code +
   * Enter). A shelf label resolves to an exact lot and pins the sale to it; a
   * product barcode adds a normal FEFO line. Scanning the same lot again just
   * bumps its quantity — the supermarket-till behaviour.
   */
  const handleScan = async (raw: string) => {
    const code = raw.trim();
    if (!code || scanBusy) return;
    setScanError(null);
    setScanBusy(true);
    try {
      const res = await inventoryApi.scan(code);
      const sp = res.product;
      if (!sp) throw new Error("Nothing matched that code.");
      // Cache it so the pricing maths can read this product after searches move on.
      setKnownProducts((cur) => ({
        ...cur,
        [sp.id]: sp as unknown as ProductRow,
      }));

      if (res.kind === "batch" && res.batch) {
        const b = res.batch;
        if (b.expired) {
          setScanError(
            `${sp.name} · batch ${b.batchNumber} has EXPIRED — not added.`,
          );
          return;
        }
        if (res.available <= 0) {
          setScanError(`${sp.name} · batch ${b.batchNumber} is out of stock.`);
          return;
        }
        setLines((cur) => {
          const idx = cur.findIndex((l) => l.batchId === b.id);
          if (idx >= 0) {
            return cur.map((l, k) =>
              k === idx
                ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) }
                : l,
            );
          }
          const line: DraftLine = {
            productId: sp.id,
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
          };
          const blank = cur.findIndex((l) => !l.productId);
          return blank >= 0
            ? cur.map((l, k) => (k === blank ? line : l))
            : [...cur, line];
        });
      } else {
        // Product barcode: a normal line, FEFO decides the batch at checkout.
        placeLine({
          productId: sp.id,
          batchId: null,
          batchNumber: null,
          expiry: null,
          available: res.available,
          unit: sp.baseUnit,
          quantity: "1",
          unitPrice: String(sp.sellingPrice),
          discount: "",
          discountMode: "amount",
          taxRate: String(sp.taxRatePct),
        });
      }
    } catch (e) {
      setScanError(apiErrorMessage(e));
    } finally {
      setScanBusy(false);
    }
  };

  // A USB scanner types wherever focus happens to be, so listen page-wide.
  // Without this, a scan lands nowhere unless the cashier clicked the box first.
  useScanGun((code) => void handleScan(code), { ignoreSelector: "#scanbox" });
  const removeLine = (i: number) =>
    setLines((cur) =>
      cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i),
    );

  // Client-side preview (tax-exclusive). Backend computes the authoritative totals.
  const calc = (l: DraftLine) => {
    const p = l.productId ? productsById[l.productId] : null;
    if (!p) return { gross: 0, discount: 0, taxable: 0, tax: 0, total: 0 };
    const factor =
      !l.unit || l.unit === p.baseUnit
        ? 1
        : (p.packs || []).find((x) => x.unit === l.unit)?.factor || 1;
    const qty = Number(l.quantity) || 0;
    const unitPrice =
      l.unitPrice === "" ? p.sellingPrice * factor : Number(l.unitPrice) || 0;
    const gross = unitPrice * qty;
    // A % discount is of this line's gross; a flat one is the rupee value typed.
    const discountInput = Number(l.discount) || 0;
    const discount =
      l.discountMode === "pct"
        ? (gross * Math.min(discountInput, 100)) / 100
        : discountInput;
    const taxable = Math.max(gross - discount, 0);
    const rate = l.taxRate === "" ? p.taxRatePct : Number(l.taxRate) || 0;
    const tax = (taxable * rate) / 100;
    return { gross, discount, taxable, tax, total: taxable + tax };
  };

  /**
   * Is this line asking for more than exists?
   *
   * Compared in BASE units on purpose: quantity is entered in the line's unit,
   * so "2 strips" of a 15-tablet strip needs 30, not 2. Returns null when the
   * stock isn't known yet — we warn about facts, never guesses.
   */
  const stockIssue = (l: DraftLine) => {
    if (l.available == null || !l.productId) return null;
    const p = productsById[l.productId];
    const factor =
      !l.unit || !p || l.unit === p.baseUnit
        ? 1
        : (p.packs || []).find((x) => x.unit === l.unit)?.factor || 1;
    const needBase = (Number(l.quantity) || 0) * factor;
    if (needBase <= l.available) return null;
    const baseUnit = p?.baseUnit || "units";
    return {
      needBase,
      available: l.available,
      message:
        l.available <= 0
          ? `Out of stock${l.batchNumber ? ` in batch ${l.batchNumber}` : ""}`
          : `Only ${l.available} ${baseUnit} available${l.batchNumber ? ` in batch ${l.batchNumber}` : ""}`,
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

  const validLines: SaleLineInput[] = lines
    .filter((l) => l.productId && Number(l.quantity) > 0)
    .map((l) => ({
      productId: l.productId!,
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
        onSuccess: (sale) => navigation.navigate("SaleDetail", { id: sale.id }),
      },
    );
  };

  return (
    <Screen
      overline="Sales"
      title="New sale"
      subtitle="FEFO auto-picks nearest-expiry batches at checkout"
      right={
        <Button
          label="Invoices"
          variant="secondary"
          fullWidth={false}
          icon={
            <History size={16} color={palette.text.primary} strokeWidth={2} />
          }
          onPress={() => navigation.navigate("SalesList")}
        />
      }
    >
      {mut.isError && (
        <View style={errorBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(mut.error)}
          </Text>
        </View>
      )}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <Select
            label="Customer (optional — walk-in if blank)"
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
              const c = await createCustomer.mutateAsync({ name: label });
              setKnownCustomers((cur) => ({ ...cur, [c.id]: c }));
              return { value: c.id, label: c.name };
            }}
            allowClear
          />
          <View>
            <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
              GST type
            </Text>
            <ChipsRow
              chips={[
                { key: "intra", label: "Intra-state (CGST+SGST)" },
                { key: "inter", label: "Inter-state (IGST)" },
              ]}
              active={taxType}
              onChange={(k) => setTaxType(k as never)}
            />
          </View>
          <View>
            <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
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
          </View>
        </VStack>
      </Card>

      {/* Scan to sell. A counter scanner types the code + Enter, so this box
          stays focused and clears itself after each scan — scan, scan, scan.
          Also accepts a typed code for shops without a scanner yet. */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={8}>
          {/* nativeID -> id="scanbox" on web, so the page-wide scanner listener
              skips keys typed here (this field handles its own Enter). */}
          <View nativeID="scanbox">
            <TextField
              label="Scan barcode / QR"
              placeholder="Scan a label — or type its code / batch no. and press Enter"
              value={scanValue}
              onChangeText={setScanValue}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                handleScan(scanValue);
                setScanValue("");
              }}
              leading={
                scanBusy ? (
                  <ActivityIndicator color={palette.teal[600]} />
                ) : (
                  <ScanLine
                    size={18}
                    color={palette.teal[600]}
                    strokeWidth={2}
                  />
                )
              }
            />
          </View>
          {scanError && (
            <HStack gap={6} align="center">
              <AlertTriangle
                size={14}
                color={palette.warning.text}
                strokeWidth={2.2}
              />
              <Text variant="caption" tone="warning">
                {scanError}
              </Text>
            </HStack>
          )}
        </VStack>
      </Card>

      <VStack gap={14}>
        {lines.map((line, i) => {
          const c = calc(line);
          return (
            <Card key={i} elevation="base">
              <VStack gap={14}>
                <HStack align="center" justify="space-between">
                  <HStack gap={8} align="center" flex={1}>
                    <Text variant="label-lg" tone="primary">
                      Item {i + 1}
                    </Text>
                    {/* A scanned line is pinned to one lot; a badge makes that
                        obvious next to the FEFO-picked (typed) lines. */}
                    {line.batchId && (
                      <View style={styles.lotBadge}>
                        <ScanLine
                          size={11}
                          color={palette.teal[700]}
                          strokeWidth={2.2}
                        />
                        <Text
                          variant="label-sm"
                          style={{ color: palette.teal[700] }}
                        >
                          Batch {line.batchNumber}
                          {line.expiry
                            ? ` · exp ${prettyExp(line.expiry)}`
                            : ""}
                        </Text>
                      </View>
                    )}
                  </HStack>
                  {lines.length > 1 && (
                    <Pressable
                      onPress={() => removeLine(i)}
                      hitSlop={8}
                      style={styles.removeBtn}
                    >
                      <X
                        size={16}
                        color={palette.danger.text}
                        strokeWidth={2}
                      />
                    </Pressable>
                  )}
                </HStack>
                <Select
                  label="Product"
                  placeholder="Search by name or SKU…"
                  value={line.productId}
                  options={productOptions}
                  selectedLabel={
                    line.productId && productsById[line.productId]
                      ? `${productsById[line.productId].name} · ${money(productsById[line.productId].sellingPrice)}/${productsById[line.productId].baseUnit}`
                      : undefined
                  }
                  onSearch={setProductQuery}
                  loading={productsLoading}
                  onChange={(v) => {
                    const p = v ? productsById[v] : null;
                    // Cache it — the maths below needs its price after the
                    // search results move on.
                    if (p) setKnownProducts((cur) => ({ ...cur, [p.id]: p }));
                    setLine(i, {
                      productId: v,
                      // Picking by hand clears any scanned lot: FEFO chooses now.
                      batchId: null,
                      batchNumber: null,
                      expiry: null,
                      available: null,
                      unit: p?.baseUnit || null,
                      unitPrice: p ? String(p.sellingPrice) : "",
                      taxRate: p ? String(p.taxRatePct) : "",
                    });
                    if (v) void loadAvailability(i, v);
                  }}
                />
                <HStack gap={12}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Qty"
                      value={line.quantity}
                      onChangeText={(v) => setLine(i, { quantity: v })}
                      keyboardType="decimal-pad"
                      // Say it here, as they type — not after a failed checkout.
                      error={stockIssue(line)?.message}
                      hint={
                        line.available != null && !stockIssue(line)
                          ? `${line.available} available`
                          : undefined
                      }
                    />
                  </View>
                  <View style={{ flex: 1.3 }}>
                    <Select
                      label="Unit"
                      placeholder="unit"
                      value={line.unit}
                      options={unitOptions(line.productId)}
                      onChange={(v) => setLine(i, { unit: v })}
                    />
                  </View>
                </HStack>
                <HStack gap={12}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Price/unit ₹"
                      value={line.unitPrice}
                      onChangeText={(v) => setLine(i, { unitPrice: v })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label={
                        line.discountMode === "pct"
                          ? "Discount %"
                          : "Discount ₹"
                      }
                      value={line.discount}
                      onChangeText={(v) => setLine(i, { discount: v })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      // Show the rupees a % works out to, so it's never a mystery.
                      hint={
                        line.discountMode === "pct" && Number(line.discount) > 0
                          ? `= ${money(calc(line).discount)} off`
                          : undefined
                      }
                      trailing={
                        <View style={styles.discToggle}>
                          {(["amount", "pct"] as const).map((m) => {
                            const active = line.discountMode === m;
                            return (
                              <Pressable
                                key={m}
                                onPress={() => setLine(i, { discountMode: m })}
                                accessibilityLabel={
                                  m === "amount"
                                    ? "Discount in rupees"
                                    : "Discount in percent"
                                }
                                style={[
                                  styles.discToggleBtn,
                                  active && styles.discToggleBtnOn,
                                ]}
                              >
                                <Text
                                  variant="label-sm"
                                  style={{
                                    color: active
                                      ? "#FFFFFF"
                                      : palette.text.tertiary,
                                  }}
                                >
                                  {m === "amount" ? "₹" : "%"}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="GST %"
                      value={line.taxRate}
                      onChangeText={(v) => setLine(i, { taxRate: v })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </HStack>
                {line.productId && (
                  <HStack justify="space-between">
                    <Text variant="caption" tone="tertiary">
                      Taxable {money(c.taxable)} + tax {money(c.tax)}
                    </Text>
                    <Text variant="label" tone="accent">
                      {money(c.total)}
                    </Text>
                  </HStack>
                )}
              </VStack>
            </Card>
          );
        })}
      </VStack>

      <Pressable onPress={addLine} style={styles.addRow}>
        <Plus size={18} color={palette.teal[600]} strokeWidth={2.2} />
        <Text variant="label" tone="accent">
          Add item
        </Text>
      </Pressable>

      <Card style={{ marginTop: 8, marginBottom: 16 }}>
        <VStack gap={8}>
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.discount > 0 && (
            <Row label="Discount" value={`- ${money(totals.discount)}`} />
          )}
          <Row label="Taxable" value={money(totals.taxable)} />
          {taxType === "intra" ? (
            <>
              <Row label="CGST" value={money(totals.tax / 2)} muted />
              <Row label="SGST" value={money(totals.tax / 2)} muted />
            </>
          ) : (
            <Row label="IGST" value={money(totals.tax)} muted />
          )}
          <View
            style={{
              height: 1,
              backgroundColor: palette.border.default,
              marginVertical: 4,
            }}
          />
          <HStack justify="space-between" align="center">
            <Text variant="h3" tone="primary">
              Grand total
            </Text>
            <Text variant="h2" tone="accent">
              {money(grand)}
            </Text>
          </HStack>
          <Text variant="caption" tone="tertiary">
            Final totals are GST-rounded on the server.
          </Text>
        </VStack>
      </Card>

      {/* Name the blocked lines before the button is pressed, so it's obvious
          WHY checkout is disabled rather than the button just looking dead. */}
      {shortLines.length > 0 && (
        <View style={warnBox}>
          <HStack gap={8} align="flex-start">
            <AlertTriangle
              size={16}
              color={palette.warning.text}
              strokeWidth={2.2}
            />
            <VStack gap={2} flex={1}>
              <Text variant="label" tone="warning">
                Not enough stock to complete this sale
              </Text>
              {shortLines.map(({ i, issue }) => (
                <Text key={i} variant="caption" tone="warning">
                  Item {i + 1}: asked for {issue!.needBase},{" "}
                  {issue!.message.charAt(0).toLowerCase() +
                    issue!.message.slice(1)}
                </Text>
              ))}
            </VStack>
          </HStack>
        </View>
      )}

      <Button
        label="Complete sale & invoice"
        size="lg"
        loading={mut.isPending}
        disabled={!validLines.length || shortLines.length > 0}
        onPress={submit}
        icon={<ShoppingCart size={18} color="#FFFFFF" strokeWidth={2} />}
      />
    </Screen>
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

const styles = StyleSheet.create({
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.danger.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  lotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: palette.teal[50],
  },
  discToggle: {
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: palette.ink[100],
  },
  discToggleBtn: {
    width: 24,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  discToggleBtnOn: {
    backgroundColor: palette.teal[600],
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    justifyContent: "center",
  },
});

const errorBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
  marginBottom: 16,
} as const;
const warnBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.warning.bg,
  borderWidth: 1,
  borderColor: palette.warning.border,
  marginBottom: 12,
} as const;
