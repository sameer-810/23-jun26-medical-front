import React, { useState } from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { useCreateReturn } from "@modules/sale/hooks/useSales";
import { Sale } from "@modules/sale/types";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius, shadows } from "@shared/designSystem";
import {
  Text,
  VStack,
  HStack,
  Button,
  TextField,
  ReasonSelect,
  reasonValue,
} from "@shared/ui";

interface Props {
  visible: boolean;
  sale: Sale;
  onClose: () => void;
}

export function ReturnModal({ visible, sale, onClose }: Props) {
  const mut = useCreateReturn();
  const [qty, setQty] = useState<Record<string, string>>({});
  // Shared with the purchase return and the write-off screen, so the same four
  // words mean the same thing wherever stock moves backwards.
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const finalReason = reasonValue(reason, customReason);

  const returnableOf = (lineId: string) => {
    const l = sale.lines.find((x) => x.id === lineId)!;
    return Math.round((l.baseQuantity - l.returnedBaseQty) * 1000) / 1000;
  };

  // Per-line check: you can't return more than was sold-and-not-yet-returned.
  const overBy = (lineId: string) =>
    (Number(qty[lineId]) || 0) > returnableOf(lineId);
  const anyOver = sale.lines.some((l) => overBy(l.id));
  const anyQty = sale.lines.some((l) => (Number(qty[l.id]) || 0) > 0);

  const submit = () => {
    const lines = sale.lines
      .map((l) => ({ lineId: l.id, baseQty: Number(qty[l.id]) || 0 }))
      .filter((l) => l.baseQty > 0);
    if (!lines.length || anyOver || !finalReason) return;
    mut.mutate(
      { saleId: sale.id, reason: finalReason, lines },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <HStack
            align="center"
            justify="space-between"
            style={{ marginBottom: 12 }}
          >
            <Text variant="h3" tone="primary">
              Return items
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          {mut.isError && (
            <View style={errBox}>
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(mut.error)}
              </Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: 340 }}>
            <VStack gap={12}>
              {sale.lines.map((l) => {
                const returnable = returnableOf(l.id);
                return (
                  <View key={l.id} style={styles.lineRow}>
                    <VStack gap={2} flex={1}>
                      <Text variant="label" tone="primary" numberOfLines={1}>
                        {l.productName}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        Sold {l.baseQuantity} · returnable {returnable}
                      </Text>
                    </VStack>
                    <View style={{ width: 100 }}>
                      <TextField
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={qty[l.id] || ""}
                        onChangeText={(v) =>
                          setQty((s) => ({ ...s, [l.id]: v }))
                        }
                        error={overBy(l.id) ? `Max ${returnable}` : undefined}
                      />
                    </View>
                  </View>
                );
              })}
            </VStack>
          </ScrollView>

          <View style={{ marginTop: 12 }}>
            <ReasonSelect
              placeholder="Why is this coming back?"
              value={reason}
              onChange={setReason}
              custom={customReason}
              onCustomChange={setCustomReason}
            />
          </View>

          {anyOver && (
            <Text variant="caption" tone="danger" style={{ marginTop: 10 }}>
              A return quantity is more than what was sold — fix the amber line.
            </Text>
          )}
          <Button
            label="Process return"
            style={{ marginTop: 16 }}
            loading={mut.isPending}
            disabled={!anyQty || anyOver || !finalReason}
            onPress={submit}
          />
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
    maxWidth: 480,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.xl,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
});

const errBox = {
  padding: 12,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
  marginBottom: 12,
} as const;
