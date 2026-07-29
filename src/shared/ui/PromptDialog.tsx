/**
 * PromptDialog — a real modal for capturing a single value (amount, password,
 * text). Replaces `window.prompt`, which is web-only and silently unavailable
 * on native — the bug that made "collect payment" impossible on mobile.
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  KeyboardTypeOptions,
} from "react-native";
import { palette, radius, shadows } from "../designSystem";
import { Text } from "./Text";
import { HStack } from "./Stack";
import { Button } from "./Button";
import { TextField } from "./TextField";

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  leading?: React.ReactNode;
  loading?: boolean;
  /** Validate on submit; return an error string to block, or null to proceed. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  visible,
  title,
  message,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  keyboardType,
  secureTextEntry,
  leading,
  loading,
  validate,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Reset the field each time the dialog opens — adjusted during render (the
  // React-recommended "reset state when a prop changes" pattern) rather than in
  // an effect.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setValue(initialValue);
      setError(null);
    }
  }

  const submit = () => {
    const err = validate ? validate(value) : null;
    if (err) {
      setError(err);
      return;
    }
    onSubmit(value.trim());
  };

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
            <Text variant="body-sm" tone="secondary" style={{ marginTop: 6 }}>
              {message}
            </Text>
          ) : null}
          <View style={{ marginTop: 16 }}>
            <TextField
              label={label}
              value={value}
              onChangeText={(t) => {
                setValue(t);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              keyboardType={keyboardType}
              secureTextEntry={secureTextEntry}
              leading={leading}
              error={error || undefined}
              autoFocus
              onSubmitEditing={submit}
            />
          </View>
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
              fullWidth={false}
              loading={loading}
              onPress={submit}
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
