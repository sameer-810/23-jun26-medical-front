import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react-native";
import { useAllLocations } from "@modules/warehouse/hooks/useWarehouse";
import {
  useCreateTransfer,
  useTransfers,
} from "@modules/stockops/hooks/useStockOps";
import {
  CellSelection,
  StockCellPicker,
  emptyCell,
} from "@modules/stockops/components/StockCellPicker";
import { apiErrorMessage } from "@api/apiClient";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
  Select,
  StatusChip,
  EmptyState,
  Banner,
} from "@shared/ui";

export default function TransfersScreen() {
  const { data: locations } = useAllLocations();
  const mut = useCreateTransfer();
  const { data: history } = useTransfers();

  const [cell, setCell] = useState<CellSelection>(emptyCell());
  const [toLocationId, setToLocationId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const sourceLoc = (locations || []).find((l) => l.id === cell.locationId);
  // Destination must be the same level (drawer↔drawer, rack↔rack) and not the source.
  const destOptions = (locations || [])
    .filter(
      (l) =>
        l.id !== cell.locationId && (!sourceLoc || l.type === sourceLoc.type),
    )
    .map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }));

  const qty = Number(quantity) || 0;
  const tooMuch = qty > cell.available;
  const ready =
    cell.productId &&
    cell.batchId &&
    cell.locationId &&
    toLocationId &&
    qty > 0 &&
    !tooMuch;

  const submit = () => {
    if (!ready) return;
    mut.mutate(
      {
        productId: cell.productId!,
        batchId: cell.batchId!,
        fromLocationId: cell.locationId!,
        toLocationId: toLocationId!,
        quantity: qty,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (t) => {
          setDone(t.transferNo);
          setCell(emptyCell());
          setToLocationId(null);
          setQuantity("");
          setNote("");
        },
      },
    );
  };

  return (
    <Screen
      overline="Stock Transfer"
      title="Move stock"
      subtitle="Drawer-to-drawer / rack-to-rack within a warehouse"
    >
      {done && (
        <Banner
          tone="success"
          message={`Transfer ${done} completed.`}
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
        <VStack gap={16}>
          <StockCellPicker
            value={cell}
            onChange={setCell}
            locationLabel="From location"
          />
          <Select
            label="To location"
            placeholder={
              cell.locationId ? "Select destination" : "Pick a source first"
            }
            value={toLocationId}
            options={destOptions}
            onChange={setToLocationId}
          />
          <TextField
            label={`Quantity (${cell.baseUnit || "base units"})`}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="0"
            error={tooMuch ? `Only ${cell.available} available` : undefined}
          />
          <TextField
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Reason for move"
          />
        </VStack>
      </Card>

      <Button
        label="Transfer stock"
        size="lg"
        loading={mut.isPending}
        disabled={!ready}
        onPress={submit}
        icon={<ArrowLeftRight size={18} color="#FFFFFF" strokeWidth={2} />}
      />

      <Text
        variant="h3"
        tone="primary"
        style={{ marginTop: 28, marginBottom: 12 }}
      >
        Transfer history
      </Text>
      {(history?.data || []).length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transfers yet" />
      ) : (
        <VStack gap={12}>
          {(history?.data || []).map((t) => (
            <Card key={t.id} elevation="base">
              <HStack align="center" justify="space-between">
                <VStack gap={3} flex={1}>
                  <Text variant="label-lg" tone="primary" numberOfLines={1}>
                    {t.transferNo} · {t.productName}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    batch {t.batchNumber} ·{" "}
                    {new Date(t.createdAt).toLocaleDateString()}
                  </Text>
                </VStack>
                <VStack gap={4} align="flex-end">
                  <StatusChip label={`${t.quantity} units`} tone="info" />
                  <Text variant="caption" tone="tertiary">
                    {t.fromLocationCode} → {t.toLocationCode}
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
