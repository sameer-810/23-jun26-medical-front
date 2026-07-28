import React from "react";
import { View, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, Undo2 } from "lucide-react-native";
import { useReceipt } from "@modules/inventory/hooks/useInventory";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
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
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={6}
        style={{ marginBottom: 16 }}
      >
        <HStack gap={6} align="center">
          <ArrowLeft size={18} color={palette.text.link} strokeWidth={2} />
          <Text variant="label" tone="link">
            Back to history
          </Text>
        </HStack>
      </Pressable>

      {isLoading || !r ? (
        <Text tone="tertiary">Loading…</Text>
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
                <Text variant="label-lg">Total</Text>
                <HStack gap={8}>
                  <StatusChip label={`${r.totalQuantity} units`} tone="info" />
                  <StatusChip label={money(r.totalValue)} tone="success" />
                </HStack>
              </HStack>
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
