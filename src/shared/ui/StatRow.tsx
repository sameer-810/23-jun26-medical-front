import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from "react-native";
import { palette, radius, outline, numeric, layout } from "../designSystem";
import { Text } from "./Text";

export interface Stat {
  key?: string;
  label: string;
  value: string;
  /** Only when the metric carries a real state (expiring, overdue). */
  accent?: { color: string; tint: string };
  hint?: string;
  trend?: { pct: number; good: boolean };
  onPress?: () => void;
}

interface Props {
  stats: Stat[];
  /** Metrics per line on wide layouts. Phones always get two. */
  columns?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * StatRow — headline metrics as one panel divided by hairlines.
 *
 * This is the single biggest visual change in the redesign. The dashboard used
 * to stack four separate 104px cards, each with its own border, coloured cap
 * and tinted icon bubble; four boxes shouting in four colours is what "made by
 * juniors" looks like, and it was the first thing on the page.
 *
 * Stripe, Mercury and Shopify all do the same thing instead: ONE surface, the
 * figures separated by 1px rules, colour only on a delta that carries meaning.
 * The metrics read as a set — which is what they are — and the eye compares
 * them left to right instead of hopping between objects.
 *
 * Phones get a two-up grid on the same panel, because a vertical rule inside a
 * 170px column leaves no room for a rupee figure.
 */
export function StatRow({ stats, columns, style }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;
  const perRow = columns ?? (wide ? Math.min(stats.length, 4) : 2);

  return (
    <View style={[styles.panel, style]}>
      {stats.map((s, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const frame: StyleProp<ViewStyle> = [
          { width: `${100 / perRow}%` as const },
          // Hairlines BETWEEN cells only — never a border box around each.
          col > 0 ? styles.divideLeft : null,
          row > 0 ? styles.divideTop : null,
        ];

        const content = (
          <>
            <View style={styles.labelRow}>
              {s.accent ? (
                <View
                  style={[styles.dot, { backgroundColor: s.accent.color }]}
                />
              ) : null}
              <Text
                variant="caption"
                tone="tertiary"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {s.label}
              </Text>
            </View>

            <View style={styles.valueRow}>
              <Text
                variant="display-sm"
                tone="primary"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={numeric}
              >
                {s.value}
              </Text>
              {s.trend ? (
                <Text
                  variant="label-sm"
                  style={{
                    marginLeft: 6,
                    marginBottom: 2,
                    color: s.trend.good
                      ? palette.success.text
                      : palette.danger.text,
                  }}
                >
                  {s.trend.pct >= 0 ? "↑" : "↓"} {Math.abs(s.trend.pct)}%
                </Text>
              ) : null}
            </View>

            {s.hint ? (
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ color: palette.text.disabled, marginTop: 1 }}
              >
                {s.hint}
              </Text>
            ) : null}
          </>
        );

        const key = s.key ?? s.label;

        if (!s.onPress) {
          return (
            <View key={key} style={[frame, styles.cell]}>
              {content}
            </View>
          );
        }
        return (
          <Pressable
            key={key}
            onPress={s.onPress}
            style={({ pressed }) => [
              frame,
              styles.cell,
              pressed ? { backgroundColor: palette.surface.sunken } : null,
            ]}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    borderColor: outline.color,
    overflow: "hidden",
  },
  cell: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    minHeight: 68,
  },
  divideLeft: {
    borderLeftWidth: 1,
    borderLeftColor: palette.border.subtle,
  },
  divideTop: {
    borderTopWidth: 1,
    borderTopColor: palette.border.subtle,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
});
