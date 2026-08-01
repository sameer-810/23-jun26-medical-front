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
  sm: { height: 38, px: 16, fontSize: 13 as const },
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.get() * 0.03 }],
    opacity: 1 - press.get() * 0.12,
  }));

  return (
    <View style={[fullWidth ? { alignSelf: "stretch" } : undefined, style]}>
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
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
          isDisabled && { opacity: 0.5 },
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
      return {
        bg: palette.cobalt[600],
        text: "#FFFFFF",
        border: palette.cobalt[600],
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
