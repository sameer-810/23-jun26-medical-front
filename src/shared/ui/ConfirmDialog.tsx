/**
 * ConfirmDialog — a real, cross-platform confirmation modal. Replaces
 * `window.confirm` (web-only, ugly, and a no-op on native) for destructive
 * actions like delete/deactivate.
 */
import React from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { palette, radius, shadows } from "../designSystem";
import { Text } from "./Text";
import { HStack } from "./Stack";
import { Button } from "./Button";

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.overlay}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="h3" tone="primary">
            {title}
          </Text>
          {message ? (
            <Text variant="body-sm" tone="secondary" style={{ marginTop: 8 }}>
              {message}
            </Text>
          ) : null}
          <HStack gap={10} justify="flex-end" style={{ marginTop: 20 }}>
            <Button
              label={cancelLabel}
              variant="secondary"
              fullWidth={false}
              disabled={loading}
              onPress={onCancel}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              fullWidth={false}
              loading={loading}
              onPress={onConfirm}
            />
          </HStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.xl,
    padding: 22,
    ...shadows.xl,
  },
});
