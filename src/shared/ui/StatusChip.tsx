import React from "react";
import { View, StyleSheet } from "react-native";
import {
  AlertTriangle,
  AlertOctagon,
  type LucideIcon,
} from "lucide-react-native";
import { palette, radius } from "../designSystem";
import { Text } from "./Text";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, { bg: string; text: string; border: string }> = {
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
  neutral: {
    bg: palette.neutral[100],
    text: palette.text.secondary,
    border: palette.border.default,
  },
};

/**
 * A glyph for the tones that carry a warning.
 *
 * WCAG 1.4.1 (and Apple's "Differentiate Without Color Alone" label criterion)
 * both say a state may not be signalled by colour on its own. Amber "Low stock"
 * and red "Expired" chips were doing exactly that: to a red-green colour-blind
 * pharmacist — roughly 1 man in 12 — they are two identically-shaped grey
 * lozenges, and the words alone don't help when you are scanning a column of
 * fifty rows for the exceptional one.
 *
 * `success` and `info` deliberately get no icon: they are the absence of a
 * problem, so adding a mark to every healthy row would put us right back to
 * decorating every line and leaving nothing for the exceptions to stand out
 * against.
 */
const TONE_ICON: Partial<Record<Tone, LucideIcon>> = {
  danger: AlertOctagon,
  warning: AlertTriangle,
};

export function StatusChip({
  label,
  tone = "neutral",
  /** Force the leading glyph on or off, when the default doesn't suit. */
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: boolean;
}) {
  const c = TONES[tone];
  const Icon = TONE_ICON[tone];
  const showIcon = icon ?? Boolean(Icon);

  return (
    <View
      style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border }]}
    >
      {showIcon && Icon ? (
        <Icon size={11} color={c.text} strokeWidth={2.4} />
      ) : null}
      <Text variant="label-sm" weight="600" style={{ color: c.text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
