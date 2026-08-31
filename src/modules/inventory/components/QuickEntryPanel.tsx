/**
 * Quick-entry row for scanned stock (client Feature 2A).
 *
 * A scan resolves the product; this panel asks for the five things the
 * distributor's pack tells you — batch, expiry, quantity, rate, rack — in
 * that order, Enter moving down the list, Enter on the last field adding
 * the line and handing focus back to the scanner. A pharmacist working down
 * a delivery never touches the 12-column grid unless something is unusual.
 *
 * When the scan was a shelf label of a lot we already stock, the batch,
 * expiry, MRP and rate arrive pre-filled — a repeat lot is qty + Enter.
 */
import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { X, PackagePlus } from "lucide-react-native";
import { DraftLine, ProductLite } from "@modules/inventory/types";
import { emptyLine } from "@modules/inventory/receiveDraft";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button, Select } from "@shared/ui";

export interface QuickEntry {
  /** Changes on every scan, so scanning the same lot twice still resets. */
  scanId: number;
  product: ProductLite;
  /** True when the scan hit a known lot (shelf label / batch number). */
  knownLot: boolean;
  batchNumber: string;
  /** YYYY-MM or "" */
  expiryDate: string;
  mrp: string;
  purchasePrice: string;
}

interface Props {
  entry: QuickEntry | null;
  locationOptions: { value: string; label: string }[];
  defaultLocationId: string | null;
  onCommit: (line: DraftLine) => void;
  onCancel: () => void;
}

export function QuickEntryPanel({ entry, ...rest }: Props) {
  if (!entry) return null;
  // Keyed by scan: a fresh scan mounts a fresh form whose state initialises
  // from the scan, instead of an effect rewriting state after render.
  return <Form key={entry.scanId} entry={entry} {...rest} />;
}

function Form({
  entry,
  locationOptions,
  defaultLocationId,
  onCommit,
  onCancel,
}: Omit<Props, "entry"> & { entry: QuickEntry }) {
  const [batch, setBatch] = useState(entry.batchNumber);
  const [expiry, setExpiry] = useState(entry.expiryDate);
  const [qty, setQty] = useState("");
  const [free, setFree] = useState("");
  const [rate, setRate] = useState(entry.purchasePrice);
  const [mrp, setMrp] = useState(entry.mrp);
  const [locationId, setLocationId] = useState<string | null>(
    defaultLocationId,
  );

  const batchRef = useRef<TextInput>(null);
  const expiryRef = useRef<TextInput>(null);
  const qtyRef = useRef<TextInput>(null);
  const freeRef = useRef<TextInput>(null);
  const rateRef = useRef<TextInput>(null);
  const mrpRef = useRef<TextInput>(null);

  // Land the cursor on the first thing still unknown — qty for a repeat lot,
  // batch for a new one.
  useEffect(() => {
    const t = setTimeout(
      () => (entry.knownLot ? qtyRef : batchRef).current?.focus(),
      50,
    );
    return () => clearTimeout(t);
  }, [entry.knownLot]);

  const qtyN = Number(qty) || 0;
  const canCommit = batch.trim().length > 0 && qtyN > 0 && !!locationId;

  const commit = () => {
    if (!canCommit) return;
    onCommit({
      ...emptyLine(),
      productId: entry.product.id,
      unit: entry.product.baseUnit,
      batchNumber: batch.trim(),
      expiryDate: expiry.trim(),
      quantity: qty,
      freeQuantity: free,
      purchasePrice: rate,
      mrp,
      locationId,
    });
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    ref: React.RefObject<TextInput | null>,
    next: React.RefObject<TextInput | null> | null,
    opts: { numeric?: boolean; placeholder?: string; width?: number } = {},
  ) => (
    <VStack gap={4} style={{ width: opts.width ?? 96 }}>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={set}
        placeholder={opts.placeholder}
        placeholderTextColor={palette.text.tertiary}
        keyboardType={opts.numeric ? "decimal-pad" : "default"}
        selectTextOnFocus
        blurOnSubmit={false}
        returnKeyType={next ? "next" : "done"}
        onSubmitEditing={() => (next ? next.current?.focus() : commit())}
        style={[
          styles.input,
          // @ts-expect-error web-only outline reset
          { outlineStyle: "none" },
        ]}
      />
    </VStack>
  );

  return (
    <View style={styles.panel}>
      <HStack
        align="center"
        justify="space-between"
        style={{ marginBottom: 8 }}
      >
        <VStack gap={0} flex={1}>
          <Text variant="label-lg" tone="primary" numberOfLines={1}>
            {entry.product.name}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {entry.product.sku} · per {entry.product.baseUnit}
            {entry.knownLot
              ? " · known lot — batch, expiry and prices pre-filled"
              : " · new lot — enter the pack's batch and expiry"}
          </Text>
        </VStack>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Dismiss">
          <X size={18} color={palette.text.tertiary} strokeWidth={2} />
        </Pressable>
      </HStack>

      <HStack gap={10} align="flex-end" wrap>
        {field("Batch", batch, setBatch, batchRef, expiryRef, {
          width: 130,
          placeholder: "e.g. KM8821",
        })}
        {field("Expiry (YYYY-MM)", expiry, setExpiry, expiryRef, qtyRef, {
          width: 120,
          placeholder: "2027-10",
        })}
        {field("Qty", qty, setQty, qtyRef, freeRef, {
          numeric: true,
          width: 72,
        })}
        {field("Free", free, setFree, freeRef, rateRef, {
          numeric: true,
          width: 64,
          placeholder: "0",
        })}
        {field("Rate", rate, setRate, rateRef, mrpRef, {
          numeric: true,
          placeholder: "0.00",
        })}
        {field("MRP", mrp, setMrp, mrpRef, null, {
          numeric: true,
          placeholder: "0.00",
        })}
        <VStack gap={4} style={{ minWidth: 180, flexGrow: 1 }}>
          <Text variant="caption" tone="tertiary">
            Rack / shelf
          </Text>
          <Select
            value={locationId}
            options={locationOptions}
            onChange={(v) => setLocationId(v)}
          />
        </VStack>
        <Button
          label="Add line"
          size="sm"
          disabled={!canCommit}
          icon={<PackagePlus size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={commit}
        />
      </HStack>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
        Enter moves to the next box; Enter on MRP adds the line and returns to
        the scanner.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    marginBottom: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.teal[500],
    backgroundColor: palette.surface.secondary,
  },
  input: {
    height: 36,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: palette.border.strong,
    borderRadius: radius.sm,
    backgroundColor: palette.surface.primary,
    color: palette.text.primary,
    fontSize: 14,
  },
});
