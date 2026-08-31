/**
 * Medicine Guide for the items on a bill (client Feature R2-3).
 *
 * Four lines per medicine — use, side effects, warnings, storage — condensed
 * server-side from the catalogue. The pharmacist reads it out, prints a slip
 * for the customer to take home, or sends it on WhatsApp with the bill.
 */
import React from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { X, Printer } from "lucide-react-native";
import { MedicineGuide } from "@modules/product/types";
import { Sale } from "@modules/sale/types";
import { printGuideSlip } from "@modules/sale/guideSlip";
import { palette, radius, shadows } from "@shared/designSystem";
import { Text, VStack, HStack, Button, StatusChip } from "@shared/ui";

interface Props {
  visible: boolean;
  sale: Sale;
  guides: Record<string, MedicineGuide>;
  shopName: string;
  onClose: () => void;
}

function Line({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <HStack gap={8} align="flex-start">
      <Text variant="label-sm" tone="secondary" style={{ width: 84 }}>
        {label}
      </Text>
      <Text variant="body-sm" tone="primary" style={{ flex: 1 }}>
        {value}
      </Text>
    </HStack>
  );
}

export function GuideModal({
  visible,
  sale,
  guides,
  shopName,
  onClose,
}: Props) {
  const items = sale.lines.map((l) => ({
    line: l,
    guide: guides[l.productId],
  }));
  const any = items.some((i) => i.guide);
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
            style={{ marginBottom: 8 }}
          >
            <VStack gap={0} flex={1}>
              <Text variant="h3" tone="primary">
                Medicine guide
              </Text>
              <Text variant="caption" tone="tertiary">
                {sale.invoiceNo} · how to use what was dispensed
              </Text>
            </VStack>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          <ScrollView style={{ maxHeight: 480 }}>
            <VStack gap={12}>
              {items.map(({ line, guide }) => (
                <View key={line.id} style={styles.item}>
                  <HStack gap={8} align="center" style={{ marginBottom: 6 }}>
                    <Text
                      variant="label"
                      tone="primary"
                      style={{ flex: 1 }}
                      numberOfLines={1}
                    >
                      {line.productName}
                    </Text>
                    {guide?.prescriptionRequired ? (
                      <StatusChip tone="warning" label="Rx" />
                    ) : null}
                  </HStack>
                  {guide ? (
                    <VStack gap={4}>
                      <Line label="Use" value={guide.use} />
                      <Line label="Side effects" value={guide.sideEffects} />
                      <Line label="Warnings" value={guide.warnings} />
                      <Line label="Storage" value={guide.storage} />
                    </VStack>
                  ) : (
                    <Text variant="caption" tone="tertiary">
                      No guide available for this item — it isn&apos;t linked to
                      the medicine catalogue.
                    </Text>
                  )}
                </View>
              ))}
            </VStack>
          </ScrollView>

          <Button
            label="Print guide slip"
            variant="secondary"
            style={{ marginTop: 12 }}
            disabled={!any}
            icon={
              <Printer
                size={16}
                color={palette.text.secondary}
                strokeWidth={2}
              />
            }
            onPress={() => void printGuideSlip(sale, guides, shopName)}
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
    maxWidth: 560,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.xl,
  },
  item: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
});
