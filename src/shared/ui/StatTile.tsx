import React from "react";
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Pressable,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { palette, radius, motion, outline } from "../designSystem";
import { Text } from "./Text";

type Tone = "light" | "teal" | "cobalt" | "slate";

interface Props {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: Tone;
  /** ServRx colour-coded card: adds a top border + tinted icon in this accent. */
  accent?: { color: string; tint: string };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * StatTile — a bento metric block (2026 bento-grid). `tone` switches between a
 * light surface and accent fills; press gives a soft spring.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tone = "light",
  accent,
  onPress,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const dark = tone !== "light";
  const valueColor = dark ? "#FFFFFF" : palette.text.primary;
  const labelColor = dark ? "rgba(255,255,255,0.82)" : palette.text.tertiary;
  const iconColor = dark
    ? "#FFFFFF"
    : accent
      ? accent.color
      : palette.teal[600];
  const iconBg = dark
    ? "rgba(255,255,255,0.18)"
    : accent
      ? accent.tint
      : palette.teal[50];

  const fill =
    tone === "teal"
      ? palette.teal[600]
      : tone === "cobalt"
        ? palette.cobalt[600]
        : tone === "slate"
          ? palette.ink[800]
          : palette.surface.primary;

  const inner = (
    <>
      {Icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon size={18} color={iconColor} strokeWidth={2} />
        </View>
      ) : null}
      <View style={{ marginTop: Icon ? 14 : 0 }}>
        <Text
          variant="display-sm"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: valueColor }}
        >
          {value}
        </Text>
        <Text variant="caption" style={{ color: labelColor, marginTop: 2 }}>
          {label}
        </Text>
        {hint ? (
          <Text
            variant="label-sm"
            style={{
              color: dark ? "rgba(255,255,255,0.75)" : palette.text.tertiary,
              marginTop: 6,
            }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </>
  );

  const body = (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: fill,
          borderColor: dark ? "transparent" : outline.color,
        },
        accent && !dark
          ? { borderTopColor: accent.color, borderTopWidth: 3 }
          : null,
        style,
      ]}
    >
      {inner}
    </View>
  );

  if (!onPress) return body;

  return (
    <Animated.View style={[animStyle, style ? undefined : { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => scale.set(withSpring(0.97, motion.spring.crisp))}
        onPressOut={() => scale.set(withSpring(1, motion.spring.gentle))}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    padding: 18,
    minHeight: 104,
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
