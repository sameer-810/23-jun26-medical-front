import React, { useMemo, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  ViewStyle,
  StyleProp,
} from "react-native";
import Svg, { Rect, Line as SvgLine } from "react-native-svg";
import { palette, radius, outline, numeric } from "../designSystem";
import { Text } from "./Text";

export interface TrendPoint {
  /** "YYYY-MM-DD". */
  date: string;
  value: number;
}

interface Props {
  data: TrendPoint[];
  /** Names what is plotted. A single-series chart needs this instead of a legend. */
  title: string;
  /** Sits under the title — the period, and any caveat about the figures. */
  subtitle?: string;
  /** Formats the axis ticks and the readout. */
  format: (n: number) => string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Round a max up to a clean axis top: 1/2/2.5/5 × a power of ten. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};

/**
 * TrendChart — daily totals as columns.
 *
 * COLUMNS, NOT A LINE, and the reason is the data rather than fashion. A line
 * implies a continuous quantity sampled over time; daily sales are a discrete
 * total per day, and this pharmacy trades on roughly a third of the days in a
 * month. A line drawn through two dozen genuine zeros invents a shape that
 * isn't there — columns say "nothing that day" without editorialising.
 *
 * Specs are the shared chart rules: bars capped well under 24px with a 4px
 * rounded top and a square foot on the baseline, a 2px surface gap between
 * neighbours, hairline recessive gridlines, no legend (one series — the title
 * names it), and labels only on the axis extremes rather than on every column.
 * The brand green is the only colour and clears 3:1 on white; all text stays in
 * ink tokens, because a value written in the series colour is unreadable.
 */
export function TrendChart({
  data,
  title,
  subtitle,
  format,
  height = 116,
  style,
}: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  /**
   * `peak` is the real highest day; `max` is the axis top rounded up from it.
   *
   * These must stay separate. The readout showed `max` at rest and labelled it
   * "peak day", so a month whose best day was ₹1,250 advertised ₹2,000 — the
   * axis rounding presented as a figure the pharmacy had actually taken.
   */
  const peak = useMemo(
    () =>
      data.reduce(
        (best, d) => (d.value > best.value ? d : best),
        data[0] ?? { date: "", value: 0 },
      ),
    [data],
  );
  const max = useMemo(() => niceMax(peak.value), [peak]);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  if (!data.length) return null;

  const GAP = 2;
  const slot = width > 0 ? width / data.length : 0;
  const barW = Math.max(1, Math.min(24, slot - GAP));
  const shown = active != null ? data[active] : null;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3" tone="primary">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="tertiary" style={{ marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/*
          The readout replaces a floating tooltip. On a 350px phone a tooltip
          over a 9px column either covers the data or points at the wrong one;
          a fixed slot in the header can't collide with anything and is reachable
          by a screen reader.
        */}
        <View style={styles.readout}>
          <Text
            variant="label"
            tone="primary"
            numberOfLines={1}
            style={numeric}
          >
            {format(shown ? shown.value : peak.value)}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {shown
              ? shortDate(shown.date)
              : peak.value > 0
                ? `peak · ${shortDate(peak.date)}`
                : "no sales"}
          </Text>
        </View>
      </View>

      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {/* Gridlines at 0 / 50% / 100% — recessive, hairline, solid. */}
            {[0, 0.5, 1].map((f) => (
              <SvgLine
                key={f}
                x1={0}
                x2={width}
                y1={height - f * height}
                y2={height - f * height}
                stroke={f === 0 ? palette.border.strong : palette.border.subtle}
                strokeWidth={1}
              />
            ))}
            {data.map((d, i) => {
              const h = max > 0 ? (d.value / max) * (height - 2) : 0;
              const isActive = active === i;
              return (
                <Rect
                  key={d.date}
                  x={i * slot + (slot - barW) / 2}
                  y={height - Math.max(h, d.value > 0 ? 2 : 0)}
                  width={barW}
                  height={Math.max(h, d.value > 0 ? 2 : 0)}
                  // Rounded top, square foot: rx on a Rect rounds all four, so
                  // the radius is kept to half the bar width and the baseline
                  // gridline covers the bottom curve.
                  rx={Math.min(4, barW / 2)}
                  fill={isActive ? palette.teal[700] : palette.teal[500]}
                  opacity={active == null || isActive ? 1 : 0.45}
                />
              );
            })}
          </Svg>
        ) : null}

        {/* Touch targets, sized for a finger rather than for the 9px column. */}
        <View style={styles.hits} pointerEvents="box-none">
          {data.map((d, i) => (
            <Pressable
              key={d.date}
              onPressIn={() => setActive(i)}
              onPressOut={() => setActive(null)}
              style={{ flex: 1 }}
              accessibilityRole="button"
              accessibilityLabel={`${shortDate(d.date)}: ${format(d.value)}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.axis}>
        <Text variant="caption" tone="tertiary" style={numeric}>
          {shortDate(data[0].date)}
        </Text>
        <Text variant="caption" tone="tertiary" style={numeric}>
          {shortDate(data[data.length - 1].date)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    borderColor: outline.color,
    padding: 14,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  readout: {
    alignItems: "flex-end",
    minWidth: 78,
  },
  // Written out rather than spread from StyleSheet.absoluteFill — that export
  // is a registered style ID (a number) on this RN version, and spreading a
  // number yields an empty object, which would leave the hit targets unpositioned.
  hits: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
});
