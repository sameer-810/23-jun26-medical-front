import React from "react";
import { View, Modal, Pressable, StyleSheet, ScrollView } from "react-native";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, PackagePlus } from "lucide-react-native";
import { NewProductDraft } from "@modules/inventory/productFromBill";
import { quickProductSchema } from "@modules/inventory/quickProduct.validation";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button } from "@shared/ui";

interface Props {
  visible: boolean;
  /** Opening values — worked out from the bill line, not blank. */
  initial: NewProductDraft;
  /** True when the bill supplied the name/pack, so we can say where it came from. */
  fromBill: boolean;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (draft: NewProductDraft) => void;
}

/**
 * Create a product without leaving the goods-received form.
 *
 * A bill is how a new product actually arrives, so being sent to the Products
 * screen mid-receipt — losing a part-typed 25-line draft — is the wrong answer.
 *
 * This asks for the few fields that are expensive to get wrong and pre-fills the
 * rest from the bill. Base unit is the one that matters: it's what stock is
 * counted in forever after, the server quietly defaults it to "pcs", and a
 * product stuck on "pcs" can never resolve a pack again.
 */
export function QuickAddProduct({
  visible,
  initial,
  fromBill,
  saving,
  error,
  onCancel,
  onSave,
}: Props) {
  // The parent remounts this per open (keyed), so `initial` seeds the form once.
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(quickProductSchema),
    mode: "onTouched",
    defaultValues: initial,
  });
  // Live values for the "1 strip = 15 tablets" helper line.
  const [packUnit, packFactor, baseUnit] = useWatch({
    control,
    name: ["packUnit", "packFactor", "baseUnit"],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <HStack gap={9} align="center" flex={1}>
              <PackagePlus
                size={19}
                color={palette.teal[600]}
                strokeWidth={2.2}
              />
              <Text variant="h4" tone="primary">
                New product
              </Text>
            </HStack>
            <Pressable onPress={onCancel} hitSlop={8}>
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
          >
            <VStack gap={12} style={{ padding: 16 }}>
              {fromBill && (
                <Text variant="caption" tone="tertiary">
                  Filled in from the bill — check it before saving. It goes into
                  your catalogue, so the name is what you&apos;ll search for
                  later.
                </Text>
              )}

              <ControlledTextField
                control={control}
                name="name"
                label="Product name"
                placeholder="e.g. Amoxycillin 500mg Capsule"
              />

              <ControlledTextField
                control={control}
                name="baseUnit"
                label="Base unit — what you count stock in"
                placeholder="tablet / capsule / ml"
                autoCapitalize="none"
              />

              {/* The bill sells packs; stock is counted in base units. Recording
                  the pack here is what lets a future bill's "2 strips" become 30
                  tablets instead of 2 of something. */}
              <VStack gap={6}>
                <Text variant="label" tone="secondary">
                  Sold in packs? (optional)
                </Text>
                <HStack gap={10}>
                  <View style={{ flex: 1.2 }}>
                    <ControlledTextField
                      control={control}
                      name="packUnit"
                      placeholder="strip"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ControlledTextField
                      control={control}
                      name="packFactor"
                      placeholder="15"
                      keyboardType="number-pad"
                    />
                  </View>
                </HStack>
                <Text variant="caption" tone="tertiary">
                  {packUnit.trim() && Number(packFactor) > 1
                    ? `1 ${packUnit.trim()} = ${packFactor} ${baseUnit.trim() || "units"}`
                    : `Leave blank if it's sold as single ${baseUnit.trim() || "units"}.`}
                </Text>
              </VStack>

              <HStack gap={10}>
                <View style={{ flex: 1 }}>
                  <ControlledTextField
                    control={control}
                    name="mrp"
                    label="MRP (₹)"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ControlledTextField
                    control={control}
                    name="gstPct"
                    label="GST %"
                    placeholder="12"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ControlledTextField
                    control={control}
                    name="hsnCode"
                    label="HSN"
                    placeholder="3004"
                    autoCapitalize="none"
                  />
                </View>
              </HStack>

              <Text variant="caption" tone="tertiary">
                An SKU is generated automatically. You can fill in category,
                brand and salt later on the Products screen.
              </Text>

              {error && (
                <View style={styles.err}>
                  <Text variant="body-sm" tone="danger">
                    {error}
                  </Text>
                </View>
              )}
            </VStack>
          </ScrollView>

          <View style={styles.footer}>
            <HStack gap={10}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="secondary" onPress={onCancel} />
              </View>
              <View style={{ flex: 1.4 }}>
                <Button
                  label={saving ? "Creating…" : "Create & use"}
                  onPress={handleSubmit((data) => onSave(data))}
                  disabled={saving}
                />
              </View>
            </HStack>
          </View>
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
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    borderRadius: radius.lg,
    backgroundColor: palette.surface.primary,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.default,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  err: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
  },
});
