import React, { useState } from "react";
import { View } from "react-native";
import { ShieldAlert, PackageX } from "lucide-react-native";
import {
  useCreateAdjustment,
  useAdjustments,
} from "@modules/stockops/hooks/useStockOps";
import {
  CellSelection,
  StockCellPicker,
  emptyCell,
} from "@modules/stockops/components/StockCellPicker";
import { AdjustmentType } from "@modules/stockops/types";
import { apiErrorMessage } from "@api/apiClient";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
  ChipsRow,
  StatusChip,
  EmptyState,
  Banner,
  ReasonSelect,
  reasonValue,
  WRITE_OFF_REASONS,
} from "@shared/ui";
import { fmtMoneyExact, fmtDate } from "@shared/format";

const TYPES = [
  { key: "damaged", label: "Damaged" },
  { key: "lost", label: "Lost" },
  { key: "expired", label: "Expired" },
  { key: "correction", label: "Correction" },
];
const money = fmtMoneyExact;
const TYPE_TONE = {
  damaged: "danger",
  lost: "danger",
  expired: "warning",
  correction: "info",
} as const;

export default function DamagedScreen() {
  const mut = useCreateAdjustment();
  const { data: history } = useAdjustments();
  const [type, setType] = useState<AdjustmentType>("damaged");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [cell, setCell] = useState<CellSelection>(emptyCell());
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const finalReason = reasonValue(reason, customReason);
  const [done, setDone] = useState<string | null>(null);

  const qty = Number(quantity) || 0;
  const effectiveDir = type === "correction" ? direction : "out";
  const tooMuch = effectiveDir === "out" && qty > cell.available;
  const ready =
    cell.productId && cell.batchId && cell.locationId && qty > 0 && !tooMuch;

  const submit = () => {
    if (!ready) return;
    mut.mutate(
      {
        type,
        direction: type === "correction" ? direction : undefined,
        productId: cell.productId!,
        batchId: cell.batchId!,
        locationId: cell.locationId!,
        quantity: qty,
        reason: finalReason || undefined,
      },
      {
        onSuccess: (a) => {
          setDone(a.adjustmentNo);
          setCell(emptyCell());
          setQuantity("");
          setReason("");
          setCustomReason("");
        },
      },
    );
  };

  return (
    <Screen
      overline="Damaged Inventory"
      title="Stock adjustment"
      subtitle="Write off damaged / lost / expired stock, or correct a count"
    >
      {done && (
        <Banner
          tone="success"
          message={`Adjustment ${done} recorded.`}
          style={{ marginBottom: 16 }}
        />
      )}
      {mut.isError && (
        <Banner
          tone="danger"
          message={apiErrorMessage(mut.error)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={12}>
          <HStack gap={12} wrap align="flex-start">
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 160 }}>
              <Text
                variant="label"
                tone="secondary"
                style={{ marginBottom: 8 }}
              >
                Reason type
              </Text>
              <ChipsRow
                chips={TYPES}
                active={type}
                onChange={(k) => setType(k as AdjustmentType)}
              />
            </View>
            {type === "correction" && (
              <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 160 }}>
                <Text
                  variant="label"
                  tone="secondary"
                  style={{ marginBottom: 8 }}
                >
                  Direction
                </Text>
                <ChipsRow
                  chips={[
                    { key: "out", label: "Remove (−)" },
                    { key: "in", label: "Add (+)" },
                  ]}
                  active={direction}
                  onChange={(k) => setDirection(k as never)}
                />
              </View>
            )}
          </HStack>
          <StockCellPicker value={cell} onChange={setCell} row />
          <HStack gap={12} wrap>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 160 }}>
              <TextField
                label={`Quantity (${cell.baseUnit || "base units"})`}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="0"
                error={tooMuch ? `Only ${cell.available} available` : undefined}
              />
            </View>
          </HStack>
          <ReasonSelect
            label="Reason"
            placeholder="Why is this stock being written off?"
            options={WRITE_OFF_REASONS}
            value={reason}
            onChange={setReason}
            custom={customReason}
            onCustomChange={setCustomReason}
          />
        </VStack>
      </Card>

      <Button
        label="Record adjustment"
        size="lg"
        loading={mut.isPending}
        disabled={!ready}
        onPress={submit}
        icon={<ShieldAlert size={18} color="#FFFFFF" strokeWidth={2} />}
      />

      <Text
        variant="h3"
        tone="primary"
        style={{ marginTop: 28, marginBottom: 12 }}
      >
        Recent adjustments
      </Text>
      {(history?.data || []).length === 0 ? (
        <EmptyState icon={PackageX} title="No adjustments yet" />
      ) : (
        <VStack gap={12}>
          {(history?.data || []).map((a) => (
            <Card key={a.id} elevation="base">
              <HStack align="center" justify="space-between">
                <VStack gap={3} flex={1}>
                  <Text variant="label-lg" tone="primary" numberOfLines={1}>
                    {a.adjustmentNo} · {a.productName}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {a.batchNumber} @ {a.locationCode} · {fmtDate(a.createdAt)}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </Text>
                </VStack>
                <VStack gap={4} align="flex-end">
                  <StatusChip
                    label={`${a.type} ${a.direction === "out" ? "−" : "+"}${a.quantity}`}
                    tone={TYPE_TONE[a.type]}
                  />
                  <Text
                    variant="caption"
                    tone={a.valueImpact < 0 ? "danger" : "success"}
                  >
                    {money(a.valueImpact)}
                  </Text>
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}
    </Screen>
  );
}
