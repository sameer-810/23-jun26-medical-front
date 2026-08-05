/**
 * Button — clinical / minimal: solid fill, soft elevation, large rounded
 * corners, subtle scale-press. Variants: primary (teal), accent (cobalt),
 * secondary (hairline outline), ghost, destructive.
 */
import React from "react";
import {
  Pressable,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { palette, radius, shadows, outline } from "../designSystem";
import { Text } from "./Text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "secondary" | "ghost" | "accent" | "destructive";
type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const SIZES = {
  // 44 is the Apple HIG / WCAG-AAA touch floor. At 38 these were reachable
  // with a mouse and fiddly with a thumb, and "sm" is what every row action
  // and toolbar button uses.
  sm: { height: 44, px: 16, fontSize: 13 as const },
  md: { height: 48, px: 18, fontSize: 15 as const },
  lg: { height: 54, px: 22, fontSize: 16 as const },
};

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  size = "md",
  icon,
  rightIcon,
  fullWidth = true,
  style,
}: Props) {
  const press = useSharedValue(0);
  const isDisabled = disabled || loading;
  const c = getVariantColors(variant);
  const s = SIZES[size];
  const flat = variant === "ghost";

  /**
   * The disabled dimming lives IN here, not in the style array.
   *
   * Reanimated writes animated styles straight onto the node, so they beat
   * anything passed through the style prop no matter where it sits in the
   * array — this worklet's resting `opacity: 1` was silently cancelling the
   * disabled state, and every disabled button in the app rendered at full
   * strength. "Process return" with nothing to return looked perfectly
   * clickable and did nothing when pressed.
   */
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.get() * 0.03 }],
    opacity: (isDisabled ? 0.5 : 1) - press.get() * 0.12,
  }));

  return (
    <View style={[fullWidth ? { alignSelf: "stretch" } : undefined, style]}>
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        /**
         * Without a role this renders as an anonymous div: a screen reader
         * announces "Return" as plain text with no hint it does anything, and
         * the whole invoice page exposed exactly one real control (the back
         * link, which happened to set its own). It is also why nothing in the
         * app could be found by role in testing.
         */
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPressIn={() => press.set(withTiming(1, { duration: 90 }))}
        onPressOut={() => press.set(withTiming(0, { duration: 140 }))}
        style={[
          styles.base,
          {
            height: s.height,
            paddingHorizontal: s.px,
            backgroundColor: c.bg,
            borderColor: c.border,
            borderWidth: c.borderWidth,
          },
          !flat && variant !== "secondary" && shadows.sm,
          animStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={c.text} size="small" />
        ) : (
          <View style={styles.row}>
            {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
            <Text
              variant="label-lg"
              weight="600"
              style={{ color: c.text, fontSize: s.fontSize }}
            >
              {label}
            </Text>
            {rightIcon && <View style={{ marginLeft: 8 }}>{rightIcon}</View>}
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
}

function getVariantColors(v: Variant) {
  switch (v) {
    case "primary":
      // 700, not the 600 logo green: button labels are 13–16px (normal-size
      // text), so the fill needs 4.5:1 against white. 600 gives 3.39, 700 gives
      // 5.48. Same brand hue, just deep enough to read all day.
      return {
        bg: palette.teal[700],
        text: "#FFFFFF",
        border: palette.teal[700],
        borderWidth: 0,
      };
    case "accent":
      // 700, not 600 — same reasoning as primary. White on cobalt[600] is
      // 3.43:1, and these labels ("New sale", "Receive stock") are 15px, so
      // they need 4.5:1, not the 3:1 allowed for large text. 700 gives 4.94.
      return {
        bg: palette.cobalt[700],
        text: "#FFFFFF",
        border: palette.cobalt[700],
        borderWidth: 0,
      };
    case "secondary":
      return {
        bg: palette.surface.primary,
        text: palette.text.primary,
        border: outline.color,
        borderWidth: 1,
      };
    case "ghost":
      return {
        bg: "transparent",
        text: palette.text.accent,
        border: "transparent",
        borderWidth: 0,
      };
    case "destructive":
      return {
        bg: palette.danger.text,
        text: "#FFFFFF",
        border: palette.danger.text,
        borderWidth: 0,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center" },
});
