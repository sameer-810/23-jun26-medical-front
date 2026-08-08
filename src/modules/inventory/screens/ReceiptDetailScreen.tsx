import React from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Undo2 } from "lucide-react-native";
import { useReceipt } from "@modules/inventory/hooks/useInventory";
import { fmtMoneyExact } from "@shared/format";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  BackLink,
  Skeleton,
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
const d = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "—";

export default function ReceiptDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { data: r, isLoading } = useReceipt(route.params?.id);

  return (
    <Screen
      overline="Stock Inward"
      title={r?.receiptNo || "Receipt"}
      subtitle={r ? new Date(r.receivedAt).toLocaleString() : ""}
      right={
        r ? (
          <Button
            label="Return to supplier"
            size="sm"
            variant="secondary"
            icon={
              <Undo2 size={16} color={palette.text.secondary} strokeWidth={2} />
            }
            onPress={() =>
              navigation.navigate("PurchaseReturn", { id: route.params?.id })
            }
          />
        ) : undefined
      }
    >
      <BackLink label="Back to history" onPress={() => navigation.goBack()} />

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
    </Screen>
  );
}
