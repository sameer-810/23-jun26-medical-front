import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from "react-native";
import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { palette, radius, outline, numeric, layout } from "../designSystem";
import { Text } from "./Text";

interface RowProps {
  title: string;
  /** Second line — SKU, manufacturer, batch, whatever identifies the record. */
  subtitle?: string;
  /** Right-hand figure. Rendered with tabular figures so columns line up. */
  value?: string;
  /** Small muted line under the value (units, "vs yesterday", a date). */
  valueHint?: string;
  /** A quiet leading mark. Not a tinted bubble — just the glyph. */
  icon?: LucideIcon;
  /** Status colour for the leading mark and the left rule. */
  accent?: { color: string; tint: string };
  /** Chips, buttons — anything that belongs at the end of the row. */
  right?: React.ReactNode;
  onPress?: () => void;
  /** Shows the ">" affordance. Defaults on when the row is pressable. */
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * ListRow — one record in a list.
 *
 * The app had no row primitive, so all 58 screens hand-rolled theirs, and the
 * Products list ended up rendering each medicine as a 118px floating card with
 * a tinted icon bubble: four products per phone screen for a chemist scanning a
 * catalogue of 117. Rows belong in a flat grouped list on ONE surface, which is
 * what every list in Shopify, Mercury and Linear is.
 *
 * Wrap a run of these in `<ListGroup>` for the surrounding surface, hairline
 * dividers and rounded ends.
 */
export function ListRow({
  title,
  subtitle,
  value,
  valueHint,
  icon: Icon,
  accent,
  right,
  onPress,
  chevron,
  style,
}: RowProps) {
  const { width } = useWindowDimensions();
  const phone = width < layout.wideBreakpoint;
  const showChevron = chevron ?? Boolean(onPress);

  const body = (
    <>
      {Icon ? (
        <Icon
          size={16}
          color={accent ? accent.color : palette.text.disabled}
          strokeWidth={2}
          style={{ marginRight: 10 }}
        />
      ) : null}

      <View style={styles.textCol}>
        <Text variant="label" tone="primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="body-sm"
            tone="tertiary"
            numberOfLines={1}
            style={{ marginTop: 1 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <View style={styles.valueCol}>
          <Text
            variant="label"
            tone="primary"
            numberOfLines={1}
            style={numeric}
          >
            {value}
          </Text>
          {valueHint ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {valueHint}
            </Text>
          ) : null}
        </View>
      ) : null}

      {right ? <View style={{ marginLeft: 10 }}>{right}</View> : null}

      {showChevron ? (
        <ChevronRight
          size={16}
          color={palette.text.disabled}
          strokeWidth={2}
          style={{ marginLeft: 8 }}
        />
      ) : null}
    </>
  );

  const frame: StyleProp<ViewStyle> = [
    styles.row,
    { minHeight: phone ? layout.rowHeightPhone : layout.rowHeight },
    accent ? { borderLeftWidth: 2, borderLeftColor: accent.color } : null,
    style,
  ];

  if (!onPress) return <View style={frame}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        frame,
        pressed ? { backgroundColor: palette.surface.sunken } : null,
      ]}
    >
      {body}
    </Pressable>
  );
}

/**
 * ListGroup — the surface a run of rows sits on.
 *
 * One border around the whole list, hairlines between the rows. The alternative
 * the app had — every row its own bordered, shadowed card with a gap under it —
 * is the pattern that made the catalogue unusable on a phone.
 */
export function ListGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {rows.map((child, i) => (
        <View key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

/** A hairline rule. Inset by default so it stops short of the card edge. */
export function Divider({
  inset = 0,
  style,
}: {
  inset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.divider, { marginHorizontal: inset }, style]} />;
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    borderColor: outline.color,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  valueCol: {
    alignItems: "flex-end",
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border.subtle,
  },
});
