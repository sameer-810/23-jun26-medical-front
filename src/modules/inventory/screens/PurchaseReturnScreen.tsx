import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Undo2 } from "lucide-react-native";
import { useReceipt } from "@modules/inventory/hooks/useInventory";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import type { PurchaseReturnPayload } from "@modules/inventory/types";
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
} from "@shared/ui";

export default function PurchaseReturnScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const receiptId = route.params?.id as string;
  const { data: receipt } = useReceipt(receiptId);

  const [qty, setQty] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (payload: PurchaseReturnPayload) =>
      inventoryApi.purchaseReturn(payload),
    onSuccess: () => navigation.goBack(),
    onError: (err) => setServerError(apiErrorMessage(err)),
  });

  const submit = () => {
    if (!receipt) return;
    setServerError(null);
    const lines = receipt.lines
      .map((l, i) => {
        const n = Number(qty[i]);
        if (!(n > 0)) return null;
        return {
          productId: l.productId,
          batchId: l.batchId,
          batchNumber: l.batchNumber,
          locationId: l.locationId,
          locationCode: l.locationCode,
          baseQuantity: Math.min(n, l.baseQuantity),
          purchasePrice: l.purchasePrice,
        };
      })
      .filter(Boolean) as PurchaseReturnPayload["lines"];

    if (lines.length === 0) {
      setServerError("Enter a return quantity for at least one line.");
      return;
    }
    mut.mutate({
      receiptId,
      supplierName: receipt.supplierName,
      reason,
      lines,
    });
  };

  return (
    <Screen
      overline="Purchase return"
      title={receipt?.receiptNo ? `Return · ${receipt.receiptNo}` : "Return"}
      subtitle={receipt?.supplierName || ""}
      right={
        <Button
          label="Back"
          size="sm"
          variant="secondary"
          icon={
            <ArrowLeft
              size={16}
              color={palette.text.secondary}
              strokeWidth={2}
            />
          }
          onPress={() => navigation.goBack()}
        />
      }
    >
      {serverError ? (
        <View style={styles.errorBox}>
          <Text variant="body-sm" tone="danger">
            {serverError}
          </Text>
        </View>
      ) : null}

      <Text variant="body-sm" tone="tertiary" style={{ marginBottom: 12 }}>
        Enter how many base units to return per line (max = received).
      </Text>

      <VStack gap={10}>
        {(receipt?.lines ?? []).map((l, i) => (
          <Card key={i}>
            <HStack gap={12} align="center" justify="space-between">
              <VStack gap={2} flex={1}>
                <Text variant="label-lg" tone="primary" numberOfLines={1}>
                  {l.productName}
                </Text>
                <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                  batch {l.batchNumber} · @ {l.locationCode} · received{" "}
                  {l.baseQuantity}
                </Text>
              </VStack>
              <View style={{ width: 92 }}>
                <TextField
                  value={qty[i] ?? ""}
                  onChangeText={(v) => setQty((s) => ({ ...s, [i]: v }))}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </View>
            </HStack>
          </Card>
        ))}
      </VStack>

      <Card style={{ marginTop: 12 }}>
        <TextField
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="Damaged / expired / wrong item…"
        />
      </Card>

      <Button
        label="Return to supplier"
        size="lg"
        icon={<Undo2 size={16} color="#FFFFFF" strokeWidth={2} />}
        style={{ marginTop: 16 }}
        loading={mut.isPending}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
    marginBottom: 16,
  },
});
