/** TextField — clinical, focus-aware, soft rounded. */
import React, { useState } from "react";
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { palette, radius, outline } from "../designSystem";
import { Text } from "./Text";
import { useControlHeight } from "./useBreakpoint";

interface Props extends Omit<TextInputProps, "style"> {
  label?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  error?: string;
  hint?: string;
}

export function TextField({
  label,
  leading,
  trailing,
  error,
  hint,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const controlHeight = useControlHeight();
  // Any password field gets a reveal toggle, unless the caller supplies its own
  // trailing element. Admins setting someone else's temporary password have no
  // way to check what they typed — and they are about to read it out loud.
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(inputProps.secureTextEntry);
  const eye =
    isPassword && !trailing ? (
      <Pressable
        onPress={() => setRevealed((r) => !r)}
        hitSlop={10}
        accessibilityLabel={revealed ? "Hide password" : "Show password"}
      >
        {revealed ? (
          <EyeOff size={18} color={palette.text.tertiary} strokeWidth={1.8} />
        ) : (
          <Eye size={18} color={palette.text.tertiary} strokeWidth={1.8} />
        )}
      </Pressable>
    ) : null;

  const borderColor = error
    ? palette.danger.text
    : focused
      ? palette.teal[500]
      : outline.color;

  return (
    <View>
      {label && (
        <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.wrap,
          {
            borderColor,
            backgroundColor: palette.surface.primary,
            borderWidth: focused ? 1.5 : 1,
            minHeight: controlHeight,
          },
        ]}
      >
        {leading && <View style={{ marginRight: 10 }}>{leading}</View>}
        <TextInput
          {...inputProps}
          secureTextEntry={isPassword && !revealed}
          placeholderTextColor={palette.text.tertiary}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          // @ts-expect-error web-only outline reset
          style={[styles.input, { outlineStyle: "none" }]}
        />
        {(trailing || eye) && (
          <View style={{ marginLeft: 10 }}>{trailing || eye}</View>
        )}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    paddingHorizontal: 11,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: palette.text.primary,
    paddingVertical: 8,
  },
});
