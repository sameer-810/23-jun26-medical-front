import React, { useState } from "react";
import { View, TextInput, ScrollView, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { Undo2 } from "lucide-react-native";
import { useReceipt } from "@modules/inventory/hooks/useInventory";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import type { PurchaseReturnPayload } from "@modules/inventory/types";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  Card,
  Button,
  TextField,
  Banner,
  BackLink,
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
    >
      <BackLink label="Back to receipt" onPress={() => navigation.goBack()} />

      {serverError ? (
        <Banner
          tone="danger"
          message={serverError}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Text variant="body-sm" tone="tertiary" style={{ marginBottom: 12 }}>
        Enter how many base units to return per line (max = received).
      </Text>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: "100%" }}
        >
          <View style={{ minWidth: "100%" }}>
            <View style={rg.head}>
              <RHead w={RC.idx} label="#" />
              <RHead w={RC.product} label="PRODUCT" left />
              <RHead w={RC.batch} label="BATCH" />
              <RHead w={RC.loc} label="LOCATION" />
              <RHead w={RC.recd} label="RECEIVED" right />
              <RHead w={RC.ret} label="RETURN QTY" />
            </View>
            {(receipt?.lines ?? []).map((l, i) => (
              <View
                key={i}
                style={[
                  rg.row,
                  i % 2 === 1 ? { backgroundColor: palette.ink[50] } : null,
                ]}
              >
                <Text
                  style={{ width: RC.idx, textAlign: "center" }}
                  variant="caption"
                  tone="tertiary"
                >
                  {i + 1}
                </Text>
                <Text
                  style={{ width: RC.product }}
                  variant="body-sm"
                  tone="primary"
                  numberOfLines={1}
                >
                  {l.productName}
                </Text>
                <Text
                  style={{ width: RC.batch }}
                  variant="body-sm"
                  tone="secondary"
                  numberOfLines={1}
                >
                  {l.batchNumber}
                </Text>
                <Text
                  style={{ width: RC.loc }}
                  variant="body-sm"
                  tone="tertiary"
                  numberOfLines={1}
                >
                  {l.locationCode}
                </Text>
                <Text
                  style={{ width: RC.recd, textAlign: "right" }}
                  variant="body-sm"
                  tone="secondary"
                >
                  {l.baseQuantity}
                </Text>
                <TextInput
                  value={qty[i] ?? ""}
                  onChangeText={(v) => setQty((s) => ({ ...s, [i]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={palette.text.tertiary}
                  selectTextOnFocus
                  style={[
                    rg.cell,
                    { width: RC.ret, textAlign: "center" },
                    // @ts-expect-error web-only outline reset
                    { outlineStyle: "none" },
                  ]}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>

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

// ---- Return line grid ----
const RC = { idx: 26, product: 220, batch: 110, loc: 110, recd: 90, ret: 100 };

function RHead({
  w,
  label,
  left,
  right,
}: {
  w: number;
  label: string;
  left?: boolean;
  right?: boolean;
}) {
  return (
    <Text
      style={{
        width: w,
        textAlign: left ? "left" : right ? "right" : "center",
      }}
      variant="overline"
      tone="tertiary"
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

const rg = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.neutral[50],
    borderBottomWidth: 1.5,
    borderBottomColor: palette.border.strong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  cell: {
    height: 38,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    fontSize: 13,
    color: palette.text.primary,
    backgroundColor: palette.surface.primary,
  },
});
