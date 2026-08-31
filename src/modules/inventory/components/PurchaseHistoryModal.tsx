/**
 * Purchase history + cheapest supplier for one medicine (client Feature 3).
 *
 * Two halves, in the order a buyer reads them: WHO to call (suppliers ranked
 * by effective rate — scheme and discount folded in, so a "10 + 1 free" line
 * ranks by what a strip really cost), then WHAT was bought (every receipt
 * line as the distributor billed it). Opens from ShortBook and from the
 * product's inventory page.
 */
import React from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { X, Trophy } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import {
  SupplierComparisonRow,
  PurchaseHistoryLine,
} from "@modules/inventory/types";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoneyExact, fmtDate } from "@shared/format";
import { palette, radius, shadows } from "@shared/designSystem";
import {
  Text,
  VStack,
  HStack,
  StatusChip,
  Skeleton,
  Banner,
  SectionHeader,
} from "@shared/ui";

interface Props {
  visible: boolean;
  productId: string | null;
  productName?: string;
  onClose: () => void;
}

const money = (n: number | null | undefined) =>
  n == null ? "—" : fmtMoneyExact(n);

function SupplierRow({ row }: { row: SupplierComparisonRow }) {
  const cheapest = row.status === "cheapest";
  return (
    <View style={[styles.row, cheapest && styles.rowCheapest]}>
      <VStack gap={2} flex={1}>
        <HStack gap={6} align="center">
          {cheapest ? (
            <Trophy size={14} color={palette.success.text} strokeWidth={2.2} />
          ) : null}
          <Text variant="label" tone="primary" numberOfLines={1}>
            {row.supplierName}
          </Text>
        </HStack>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {row.lastDate ? fmtDate(row.lastDate) : "—"}
          {row.batchNumber ? ` · ${row.batchNumber}` : ""} · {row.scheme}
        </Text>
      </VStack>
      <VStack gap={2} align="flex-end">
        <Text variant="label-lg" weight="700" tone="primary">
          {money(row.effectiveRate)}
          <Text variant="caption" tone="tertiary">
            {row.unit ? ` /${row.unit}` : ""}
          </Text>
        </Text>
        {cheapest ? (
          <StatusChip
            tone="success"
            label={
              row.deltaPct < 0
                ? `Cheapest (${row.deltaPct}%)`
                : "Only supplier"
            }
          />
        ) : (
          <Text variant="caption" tone="warning">
            +{row.deltaPct}%
          </Text>
        )}
      </VStack>
    </View>
  );
}

function PurchaseRow({ line }: { line: PurchaseHistoryLine }) {
  return (
    <View style={styles.row}>
      <VStack gap={2} flex={1}>
        <Text variant="label" tone="primary" numberOfLines={1}>
          {line.supplierName || "Unknown supplier"}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {fmtDate(line.date)} · {line.receiptNo}
          {line.referenceNo ? ` (${line.referenceNo})` : ""}
          {line.batchNumber ? ` · lot ${line.batchNumber}` : ""}
          {line.expiryDate ? ` · exp ${fmtDate(line.expiryDate)}` : ""}
        </Text>
        <Text variant="caption" tone="secondary">
          {line.quantity} {line.unit}
          {line.freeQuantity > 0 ? ` + ${line.freeQuantity} free` : ""}
          {line.billedRate != null ? ` @ ${money(line.billedRate)}` : ""}
          {line.discountAmount > 0
            ? ` · less ${money(line.discountAmount)}`
            : ""}
          {line.mrp > 0 ? ` · MRP ${money(line.mrp)}` : ""}
        </Text>
      </VStack>
      <VStack gap={2} align="flex-end">
        <Text variant="label" tone="primary">
          {money(line.effectiveRate)}
        </Text>
        <Text variant="caption" tone="tertiary">
          effective /{line.unit}
        </Text>
      </VStack>
    </View>
  );
}

export function PurchaseHistoryModal({
  visible,
  productId,
  productName,
  onClose,
}: Props) {
  const q = useQuery({
    queryKey: ["inventory", "purchases", productId],
    queryFn: () => inventoryApi.productPurchases(productId as string),
    enabled: visible && !!productId,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <HStack align="center" justify="space-between" style={{ marginBottom: 4 }}>
            <VStack gap={0} flex={1}>
              <Text variant="h3" tone="primary" numberOfLines={1}>
                {q.data?.product.name || productName || "Purchase history"}
              </Text>
              <Text variant="caption" tone="tertiary">
                Where it was bought, and who sells it cheapest
              </Text>
            </VStack>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          <ScrollView style={{ maxHeight: 520 }}>
            {q.isError ? (
              <Banner tone="danger" message={apiErrorMessage(q.error)} />
            ) : q.isLoading ? (
              <VStack gap={8} style={{ marginTop: 12 }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </VStack>
            ) : (
              <>
                <SectionHeader
                  title="Suppliers"
                  count={q.data?.suppliers.length ?? 0}
                />
                {q.data?.suppliers.length ? (
                  q.data.suppliers.map((s) => (
                    <SupplierRow key={`${s.supplierId}-${s.supplierName}`} row={s} />
                  ))
                ) : (
                  <Text variant="body-sm" tone="tertiary">
                    Never received from a supplier yet.
                  </Text>
                )}
                {q.data?.suppliers.length ? (
                  <Text
                    variant="caption"
                    tone="tertiary"
                    style={{ marginTop: 6 }}
                  >
                    Effective rate = (billed − discount) ÷ (billed + free
                    packs), from each supplier&apos;s latest bill.
                  </Text>
                ) : null}

                <SectionHeader
                  title="Purchase history"
                  count={q.data?.purchases.length ?? 0}
                  style={{ marginTop: 16 }}
                />
                {q.data?.purchases.map((p) => (
                  <PurchaseRow key={`${p.receiptId}-${p.batchNumber}`} line={p} />
                ))}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  rowCheapest: {
    backgroundColor: palette.success.bg,
    borderRadius: radius.md,
    borderBottomWidth: 0,
  },
});
