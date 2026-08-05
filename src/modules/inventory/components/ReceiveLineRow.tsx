import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { X, ChevronDown, ChevronRight } from "lucide-react-native";
import { DraftLine, ProductLite } from "@modules/inventory/types";
import {
  baseQty,
  lineStatus,
  lineTitle,
  summaryLine,
  unitOptions,
  LineTone,
} from "@modules/inventory/receiveDraft";
import { palette, radius } from "@shared/designSystem";
import {
  Text,
  VStack,
  HStack,
  Card,
  TextField,
  Select,
  DateField,
} from "@shared/ui";

interface Props {
  index: number;
  line: DraftLine;
  product: ProductLite | null;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftLine>) => void;
  onPickProduct: (id: string | null) => void;
  onRemove?: () => void;
  productOptions: { value: string; label: string }[];
  onSearchProducts: (q: string) => void;
  productsLoading?: boolean;
  locationOptions: { value: string; label: string }[];
  /** Offer to create the product from here. Omitted without `products.manage`. */
  onRequestCreateProduct?: (query: string) => void;
}

/**
 * One goods-received line: a compact row that opens into the full form.
 *
 * Collapsed by default so a 25-line scanned bill is readable at a glance — the
 * row states what's still missing (product / batch / qty / location) so gaps are
 * spotted without opening every form.
 */
export function ReceiveLineRow({
  index,
  line,
  product,
  open,
  onToggle,
  onChange,
  onPickProduct,
  onRemove,
  productOptions,
  onSearchProducts,
  productsLoading,
  locationOptions,
  onRequestCreateProduct,
}: Props) {
  const status = lineStatus(line);
  const title = lineTitle(line, product);
  const Chevron = open ? ChevronDown : ChevronRight;
  // Three fields across only where they'd still be readable; a phone stacks them.
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  return (
    <Card elevation="base" style={{ padding: 0 }}>
      <Pressable onPress={onToggle} style={styles.head}>
        <Chevron size={17} color={palette.text.tertiary} strokeWidth={2} />
        <VStack gap={2} flex={1}>
          <Text
            variant="label-lg"
            tone={product ? "primary" : "tertiary"}
            numberOfLines={1}
          >
            {index + 1}. {title.text}
            {/* Naming the bill's wording without implying we linked it. */}
            {!title.matched && title.text !== "Choose a product"
              ? "  (on bill)"
              : ""}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {summaryLine(line, product)}
          </Text>
        </VStack>
        <View style={[styles.pill, toneBg(status.tone)]}>
          <Text variant="label-sm" style={{ color: toneText(status.tone) }}>
            {status.label}
          </Text>
        </View>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8} style={styles.remove}>
            <X size={15} color={palette.danger.text} strokeWidth={2} />
          </Pressable>
        )}
      </Pressable>

      {open && (
        <VStack gap={10} style={styles.body}>
          {/* Product gets its own row — names are long and it's the key field. */}
          <Select
            label="Product"
            placeholder="Search by name or SKU…"
            value={line.productId}
            options={productOptions}
            selectedLabel={
              product ? `${product.name} · ${product.sku}` : undefined
            }
            onSearch={onSearchProducts}
            loading={productsLoading}
            onChange={onPickProduct}
            onRequestCreate={onRequestCreateProduct}
            createNoun="product"
          />

          {/* An unmatched scanned line: say what the bill called it, since the
              picker's search box starts empty and the name is the only clue. */}
          {!product && line.fromBill?.productName && (
            <Text variant="caption" tone="warning">
              Bill says &ldquo;{line.fromBill.productName}
              {line.fromBill.pack ? ` · ${line.fromBill.pack}` : ""}&rdquo; —
              search for it above, or add it as a new product.
            </Text>
          )}

          {/* Batch · Qty · Unit — quantity and its unit are one thought ("5 pcs"),
              so they sit together instead of Unit hogging a whole row. */}
          <HStack gap={10}>
            <View style={{ flex: 1.5 }}>
              <TextField
                label="Batch no."
                value={line.batchNumber}
                onChangeText={(v) => onChange({ batchNumber: v })}
                placeholder="B-001"
              />
            </View>
            <View style={{ flex: 0.8 }}>
              <TextField
                label="Qty"
                value={line.quantity}
                onChangeText={(v) => onChange({ quantity: v })}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1.1 }}>
              <Select
                label="Unit"
                placeholder="Unit"
                value={line.unit}
                options={unitOptions(product)}
                onChange={(v) => onChange({ unit: v })}
              />
            </View>
          </HStack>

          {/* Dates + money. On desktop the two dates share a row and the two
              prices share the next; a phone stacks each pair. MRP sits beside
              cost because they're the two money fields — and MRP prints on the
              shelf label, so it earns a spot on the form. */}
          {wide ? (
            <>
              <HStack gap={10}>
                <View style={{ flex: 1 }}>
                  {/* A month, not a day — packs print "EXP 08/2026" and the
                      lot is good to the end of that month. */}
                  <DateField
                    label="Expiry date"
                    mode="month"
                    value={line.expiryDate}
                    onChange={(v) => onChange({ expiryDate: v })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {/* Month, like expiry — a pack prints "MFG 03/2026", and the
                      grid layout of this same field has always taken YYYY-MM.
                      One field must not behave differently in two layouts. */}
                  <DateField
                    label="Mfg date"
                    mode="month"
                    value={line.mfgDate}
                    onChange={(v) => onChange({ mfgDate: v })}
                    placeholder="optional"
                    maximumDate={new Date()}
                  />
                </View>
              </HStack>
              <HStack gap={10}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Cost / base (₹)"
                    value={line.purchasePrice}
                    onChangeText={(v) => onChange({ purchasePrice: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="MRP (₹)"
                    value={line.mrp}
                    onChangeText={(v) => onChange({ mrp: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </HStack>
            </>
          ) : (
            <>
              <HStack gap={10}>
                <View style={{ flex: 1 }}>
                  {/* A month, not a day — packs print "EXP 08/2026" and the
                      lot is good to the end of that month. */}
                  <DateField
                    label="Expiry date"
                    mode="month"
                    value={line.expiryDate}
                    onChange={(v) => onChange({ expiryDate: v })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {/* Month, like expiry — a pack prints "MFG 03/2026", and the
                      grid layout of this same field has always taken YYYY-MM.
                      One field must not behave differently in two layouts. */}
                  <DateField
                    label="Mfg date"
                    mode="month"
                    value={line.mfgDate}
                    onChange={(v) => onChange({ mfgDate: v })}
                    placeholder="optional"
                    maximumDate={new Date()}
                  />
                </View>
              </HStack>
              <HStack gap={10}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Cost / base (₹)"
                    value={line.purchasePrice}
                    onChangeText={(v) => onChange({ purchasePrice: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="MRP (₹)"
                    value={line.mrp}
                    onChangeText={(v) => onChange({ mrp: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </HStack>
            </>
          )}

          {/* Location keeps a full row — codes like "WH1-Z1-W1-S2 — Shelf 2" are long. */}
          <Select
            label="Storage location"
            placeholder="Where?"
            value={line.locationId}
            options={locationOptions}
            onChange={(v) => onChange({ locationId: v })}
          />

          {product && Number(line.quantity) > 0 && (
            <Text variant="caption" tone="tertiary">
              = {baseQty(line, product)} {product.baseUnit} in base units
            </Text>
          )}
        </VStack>
      )}
    </Card>
  );
}

const toneBg = (t: LineTone) =>
  t === "ok"
    ? {
        backgroundColor: palette.success.bg,
        borderColor: palette.success.border,
      }
    : t === "warn"
      ? {
          backgroundColor: palette.warning.bg,
          borderColor: palette.warning.border,
        }
      : {
          backgroundColor: palette.ink[100],
          borderColor: palette.border.default,
        };

const toneText = (t: LineTone) =>
  t === "ok"
    ? palette.success.text
    : t === "warn"
      ? palette.warning.text
      : palette.text.tertiary;

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border.subtle,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  remove: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: palette.danger.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
