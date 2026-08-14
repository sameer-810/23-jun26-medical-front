/**
 * Button — flat fill, tight radius, no shadow. Variants: primary (brand green),
 * accent (cobalt), secondary (hairline outline), ghost, destructive.
 */
import React from "react";
import {
  Pressable,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { palette, radius, outline, layout } from "../designSystem";
import { Text } from "./Text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "secondary" | "ghost" | "accent" | "destructive";
type Size = "xs" | "sm" | "md" | "lg";

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

/**
 * Two ladders, because this one codebase is both a phone app and a counter-PC
 * desktop app and the right control height is genuinely different.
 *
 * A pointer wants 32px (Atlassian's default; Polaris sits at 28–32) — 48px
 * buttons on a 1440px screen are what made the toolbars look oversized. A thumb
 * wants the 44px Apple HIG floor. Neither number is correct for both, so the
 * component picks per layout rather than shipping one compromise.
 */
const DESKTOP = {
  xs: { height: 28, px: 10, fontSize: 12 as const },
  sm: { height: 32, px: 12, fontSize: 13 as const },
  md: { height: 36, px: 14, fontSize: 14 as const },
  lg: { height: 40, px: 18, fontSize: 14 as const },
};

/**
 * Every phone size is at least 44.
 *
 * The first cut of this ladder had `xs: 34`, which was wrong twice over: it is
 * under Apple's 44pt floor and well under Material's 48dp, and it was being
 * used for row actions — the very buttons a pharmacist hits most. Density on a
 * pointer surface is a nicety; density on a touch surface is a mis-tap. The
 * sizes now differ only in padding and label size, not in how big a target
 * your thumb gets.
 */
const PHONE = {
  xs: { height: 44, px: 12, fontSize: 13 as const },
  sm: { height: 44, px: 14, fontSize: 13 as const },
  md: { height: 46, px: 16, fontSize: 14 as const },
  lg: { height: 50, px: 20, fontSize: 15 as const },
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
  const { width } = useWindowDimensions();
  const isDisabled = disabled || loading;
  const c = getVariantColors(variant);
  const s = (width >= layout.wideBreakpoint ? DESKTOP : PHONE)[size];

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
            // minHeight, not height: with OS text scaling turned up the label
            // needs more room than the slot, and a fixed height clips it —
            // silently, since RN 0.85 hides text overflowing a border radius.
            minHeight: s.height,
            paddingHorizontal: s.px,
            paddingVertical: 6,
            backgroundColor: c.bg,
            borderColor: c.border,
            borderWidth: c.borderWidth,
          },
          // No shadow. A filled button is already the loudest thing on the row;
          // lifting it off the page as well is the "junior" tell.
          animStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={c.text} size="small" />
        ) : (
          <View style={styles.row}>
            {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
            <Text
              variant="label"
              weight="600"
              style={{ color: c.text, fontSize: s.fontSize }}
            >
              {label}
            </Text>
            {rightIcon && <View style={{ marginLeft: 6 }}>{rightIcon}</View>}
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
