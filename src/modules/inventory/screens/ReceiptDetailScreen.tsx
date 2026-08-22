import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2, Ban } from "lucide-react-native";
import { useReceipt } from "@modules/inventory/hooks/useInventory";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoneyExact, fmtDate, fmtDateTime } from "@shared/format";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  Banner,
  StatusChip,
  Skeleton,
  ErrorState,
  PromptDialog,
} from "@shared/ui";

/**
 * To the paisa. A goods-received note is checked against a supplier's invoice,
 * and that invoice settles at two decimals — a rounded figure here cannot be
 * reconciled with it, and the difference is exactly what a query is about.
 */
const money = fmtMoneyExact;

/** One line of the invoice's totals block. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="space-between">
      <Text variant="body-sm" tone="secondary">
        {label}
      </Text>
      <Text variant="label-sm" tone="primary">
        {value}
      </Text>
    </HStack>
  );
}
const d = fmtDate;

export default function ReceiptDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { data: r, isLoading, isError, error } = useReceipt(route.params?.id);
  const qc = useQueryClient();
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const voided = r?.status === "void";

  const voidMut = useMutation({
    mutationFn: (reason: string) =>
      inventoryApi.voidReceipt(route.params?.id, reason),
    onSuccess: () => {
      // The reversal moves stock and cost, so everything counting either is stale.
      qc.invalidateQueries({ queryKey: ["receipt", route.params?.id] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-value"] });
      qc.invalidateQueries({ queryKey: ["product-inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setVoidOpen(false);
    },
    onError: (e) => {
      setVoidError(apiErrorMessage(e));
      setVoidOpen(false);
    },
  });

  if (isError) {
    return (
      <Screen back="Back to history" overline="Stock Inward" title="Receipt">
        <ErrorState
          error={error}
          title="This receipt isn't available"
          message="It may have been removed, or the link may be out of date. Open the receiving history to find it."
          actionLabel="Go to history"
          onAction={() =>
            navigation.navigate("Receive", { screen: "Receipts" })
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      back="Back to history"
      overline="Stock Inward"
      title={r?.receiptNo || "Receipt"}
      subtitle={r ? fmtDateTime(r.receivedAt) : ""}
      right={
        r && !voided ? (
          <HStack gap={8}>
            <Button
              label="Return to supplier"
              size="sm"
              variant="secondary"
              icon={
                <Undo2
                  size={16}
                  color={palette.text.secondary}
                  strokeWidth={2}
                />
              }
              onPress={() =>
                navigation.navigate("PurchaseReturn", { id: route.params?.id })
              }
            />
            {/* Correction for a mis-keyed GRN. A return is the right tool when
                goods physically go back to the supplier; this is for a note
                that should never have been entered. */}
            <Button
              label="Void GRN"
              size="sm"
              variant="secondary"
              icon={
                <Ban size={16} color={palette.danger.text} strokeWidth={2} />
              }
              onPress={() => setVoidOpen(true)}
            />
          </HStack>
        ) : undefined
      }
    >
      {isLoading || !r ? (
        <VStack gap={16}>
          <Card>
            <VStack gap={10}>
              {[0, 1, 2].map((i) => (
                <HStack key={i} justify="space-between">
                  <Skeleton width="35%" height={14} />
                  <Skeleton width="45%" height={14} />
                </HStack>
              ))}
            </VStack>
          </Card>
          {[0, 1].map((i) => (
            <Card key={i} elevation="base">
              <VStack gap={8}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="50%" height={14} />
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : (
        <>
          {/* The figures below are what the note was written for; a voided GRN
              no longer contributes any of them. */}
          {voided ? (
            <Banner
              tone="danger"
              title="This GRN was voided"
              message={`${r.voidReason || "No reason recorded"}${r.voidedByName ? ` — ${r.voidedByName}` : ""}. Its stock was reversed and it counts towards nothing.`}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {voidError ? (
            <Banner
              tone="danger"
              message={voidError}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <Card style={{ marginBottom: 16 }}>
            <VStack gap={8}>
              <HStack justify="space-between">
                <Text variant="body-sm" tone="tertiary">
                  Supplier
                </Text>
                <Text variant="label">{r.supplierName || "—"}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text variant="body-sm" tone="tertiary">
                  Reference
                </Text>
                <Text variant="label">{r.referenceNo || "—"}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text variant="body-sm" tone="tertiary">
                  Received by
                </Text>
                <Text variant="label">{r.receivedByName || "—"}</Text>
              </HStack>
              <View
                style={{
                  height: 1,
                  backgroundColor: palette.border.subtle,
                  marginVertical: 4,
                }}
              />
              <HStack justify="space-between">
                <Text variant="label-lg">Amount</Text>
                <HStack gap={8}>
                  <StatusChip label={`${r.totalQuantity} units`} tone="info" />
                  <StatusChip label={money(r.totalValue)} tone="success" />
                </HStack>
              </HStack>

              {/* The rest of the supplier's totals block, in its order and its
                  words. Only shown once a bill's discount/GST were actually
                  keyed — older notes have none and would just print zeros. */}
              {r.totalGst > 0 || r.totalDiscount > 0 ? (
                <>
                  {r.totalDiscount > 0 ? (
                    <Row
                      label="Disc amt"
                      value={`−${money(r.totalDiscount)}`}
                    />
                  ) : null}
                  <Row label="Taxable" value={money(r.totalTaxable)} />
                  {r.taxType === "inter" ? (
                    <Row label="IGST" value={money(r.igstAmount)} />
                  ) : (
                    <>
                      <Row label="CGST" value={money(r.cgstAmount)} />
                      <Row label="SGST" value={money(r.sgstAmount)} />
                    </>
                  )}
                  <Row label="Total amt" value={money(r.grandTotal)} />
                  {r.roundOff !== 0 ? (
                    <Row
                      label="Round off"
                      value={`${r.roundOff > 0 ? "+" : "−"}${money(Math.abs(r.roundOff))}`}
                    />
                  ) : null}
                  {/* After the round-off, as the supplier's bill prints it. */}
                  <HStack justify="space-between">
                    <Text variant="label-lg">To pay</Text>
                    <Text variant="label-lg" tone="accent">
                      {money(r.netPayable)}
                    </Text>
                  </HStack>
                </>
              ) : null}
            </VStack>
          </Card>

          <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
            Lines
          </Text>
          <VStack gap={12}>
            {r.lines.map((l, i) => (
              <Card key={i} elevation="base">
                <VStack gap={8}>
                  <HStack justify="space-between" align="center">
                    <Text
                      variant="label-lg"
                      tone="primary"
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {l.productName}
                    </Text>
                    <Text variant="label-lg" tone="primary">
                      {l.baseQuantity} {/* base units */}
                    </Text>
                  </HStack>
                  <Text variant="body-sm" tone="tertiary">
                    {l.sku} · batch {l.batchNumber} · {l.quantity} {l.unit}
                  </Text>
                  <HStack gap={6} wrap>
                    <StatusChip label={`@ ${l.locationCode}`} tone="neutral" />
                    <StatusChip
                      label={`exp ${d(l.expiryDate)}`}
                      tone={l.expiryDate ? "warning" : "neutral"}
                    />
                    <StatusChip
                      label={`${money(l.lineValue)}`}
                      tone="success"
                    />
                  </HStack>
                </VStack>
              </Card>
            ))}
          </VStack>
        </>
      )}

      <PromptDialog
        visible={voidOpen}
        title={`Void ${r?.receiptNo || "this GRN"}?`}
        message="The stock this note added is taken back off the shelf and each batch's cost is restored. The GRN stays in the history, marked void. It cannot be undone — and it will be refused if any of the goods have already been sold or moved."
        label="Why is this being voided?"
        placeholder="e.g. entered twice, wrong supplier"
        confirmLabel="Void GRN"
        loading={voidMut.isPending}
        validate={(v) =>
          v.trim().length < 3
            ? "Give a short reason — it is the only record of why."
            : null
        }
        onSubmit={(reason) => voidMut.mutate(reason.trim())}
        onCancel={() => setVoidOpen(false)}
      />
    </Screen>
  );
}
