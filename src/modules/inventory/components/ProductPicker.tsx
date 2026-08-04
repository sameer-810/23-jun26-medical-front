import React from "react";
import { View, Modal, Pressable, StyleSheet } from "react-native";
import { X, Search } from "lucide-react-native";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Combobox } from "@shared/ui";
import type { ComboItem } from "@shared/ui";

interface Props {
  visible: boolean;
  query: string;
  onQueryChange: (s: string) => void;
  items: ComboItem[];
  loading?: boolean;
  emptyText?: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}

/**
 * Pick the product for one goods-received line.
 *
 * A modal rather than a dropdown inside the cell: the line grid scrolls
 * horizontally inside a clipped card, so an absolutely-positioned panel would
 * be cut off after a few pixels. The trade is worth it — what matters is that
 * the row searches your stock AND the global catalogue before offering to
 * create anything, which is what stops the same medicine being typed in twice
 * under two spellings.
 */
export function ProductPicker({
  visible,
  query,
  onQueryChange,
  items,
  loading,
  emptyText,
  onSelect,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Swallow presses inside the sheet so it doesn't close under you. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <VStack gap={14}>
            <HStack align="center" gap={10}>
              <View style={styles.icon}>
                <Search size={18} color={palette.teal[700]} strokeWidth={2} />
              </View>
              <VStack gap={1} flex={1}>
                <Text variant="h4" tone="primary">
                  Set product
                </Text>
                <Text variant="caption" tone="tertiary">
                  Your stock first, then the medicine catalogue
                </Text>
              </VStack>
              <Pressable
                onPress={onCancel}
                hitSlop={8}
                style={styles.close}
                accessibilityLabel="Close"
              >
                <X size={18} color={palette.text.tertiary} strokeWidth={2} />
              </Pressable>
            </HStack>

            <Combobox
              autoFocus
              placeholder="Search medicine…"
              query={query}
              onQueryChange={onQueryChange}
              items={items}
              loading={loading}
              onSelect={onSelect}
              emptyText={emptyText}
              alwaysOpen
              leading={
                <Search
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              }
            />
          </VStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
