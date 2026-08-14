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
import { palette, radius, motion, outline, numeric } from "../designSystem";
import { Text } from "./Text";

type Tone = "light" | "teal" | "cobalt" | "slate";

interface Props {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: Tone;
  /**
   * Status accent. Only pass this when the metric genuinely carries a state
   * (expiring soon = red, dues = amber). A metric with no status gets no
   * colour — that restraint is the whole point of the new system.
   */
  accent?: { color: string; tint: string };
  /**
   * Period-over-period change chip. `pct` sign drives the arrow; `good` drives
   * the colour (a rise in sales is good/green, a rise in dues is bad/red).
   */
  trend?: { pct: number; good: boolean };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * StatTile — a single metric in a bordered tile.
 *
 * Rebuilt for density. It used to be 104px tall with 18px padding, a 38px
 * tinted icon bubble, a 26px number and a 3px coloured cap — roughly 28,000px²
 * of card to display ten characters. It is now a 72px tile: label above value,
 * icon demoted to a small mark beside the label, no coloured cap unless the
 * metric carries a real status.
 *
 * For a dashboard's headline metrics prefer `StatRow`, which drops the boxes
 * altogether and separates figures with hairlines the way Stripe does.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tone = "light",
  accent,
  trend,
  onPress,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const dark = tone !== "light";
  const valueColor = dark ? "#FFFFFF" : palette.text.primary;
  const labelColor = dark ? "rgba(255,255,255,0.90)" : palette.text.tertiary;
  const iconColor = dark
    ? "rgba(255,255,255,0.85)"
    : accent
      ? accent.color
      : palette.text.disabled;

  const fill =
    tone === "teal"
      ? palette.teal[700]
      : tone === "cobalt"
        ? palette.cobalt[700]
        : tone === "slate"
          ? palette.ink[800]
          : palette.surface.primary;

  const trendColor = trend
    ? dark
      ? "#FFFFFF"
      : trend.good
        ? palette.success.text
        : palette.danger.text
    : undefined;

  const inner = (
    <>
      {/* Label line — the metric's name, with the icon as a quiet mark. */}
      <View style={styles.labelRow}>
        {Icon ? (
          <Icon
            size={13}
            color={iconColor}
            strokeWidth={2}
            style={{ marginRight: 6 }}
          />
        ) : null}
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: labelColor, flex: 1 }}
        >
          {label}
        </Text>
      </View>

      {/* Value line — the figure, with any delta sitting beside it. */}
      <View style={styles.valueRow}>
        <Text
          variant="display-sm"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[{ color: valueColor }, numeric]}
        >
          {value}
        </Text>
        {trend ? (
          <Text
            variant="label-sm"
            style={{ color: trendColor, marginLeft: 6, marginBottom: 2 }}
          >
            {trend.pct >= 0 ? "↑" : "↓"} {Math.abs(trend.pct)}%
          </Text>
        ) : null}
      </View>

      {hint ? (
        <Text
          variant="caption"
          numberOfLines={1}
          style={{
            color: dark ? "rgba(255,255,255,0.72)" : palette.text.disabled,
            marginTop: 1,
          }}
        >
          {hint}
        </Text>
      ) : null}
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
        // A left rule, not a full cap across the top: it marks the status
        // without turning the tile into a coloured object.
        accent && !dark
          ? { borderLeftColor: accent.color, borderLeftWidth: 2 }
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
        onPressIn={() => scale.set(withSpring(0.99, motion.spring.crisp))}
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    justifyContent: "center",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
});
