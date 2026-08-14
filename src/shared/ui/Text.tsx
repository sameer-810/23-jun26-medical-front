/** Text — all typography routes through here for a consistent type system. */
import React from "react";
import { Text as RNText, TextStyle, StyleProp } from "react-native";
import { typography, palette, fonts } from "../designSystem";

type Variant =
  | "display-lg"
  | "display-md"
  | "display-sm"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body-lg"
  | "body"
  | "body-sm"
  | "label-lg"
  | "label"
  | "label-sm"
  | "caption"
  | "overline";

type Tone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "disabled"
  | "inverse"
  | "accent"
  | "link"
  | "danger"
  | "success"
  | "warning";

interface Props {
  variant?: Variant;
  tone?: Tone;
  weight?: "400" | "500" | "600" | "700";
  align?: "left" | "center" | "right";
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  /**
   * Override the role's OS-text-scaling ceiling. Pass `0` for "no limit" —
   * see MAX_SCALE below for why the defaults exist.
   */
  maxFontSizeMultiplier?: number;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

const variantMap = {
  "display-lg": typography.display.large,
  "display-md": typography.display.medium,
  "display-sm": typography.display.small,
  h1: typography.heading.h1,
  h2: typography.heading.h2,
  h3: typography.heading.h3,
  h4: typography.heading.h4,
  "body-lg": typography.body.large,
  body: typography.body.default,
  "body-sm": typography.body.small,
  "label-lg": typography.label.large,
  label: typography.label.medium,
  "label-sm": typography.label.small,
  caption: typography.caption,
  overline: typography.overline,
} as const;

const toneMap: Record<Tone, string> = {
  primary: palette.text.primary,
  secondary: palette.text.secondary,
  tertiary: palette.text.tertiary,
  disabled: palette.text.disabled,
  inverse: palette.text.inverse,
  accent: palette.text.accent,
  link: palette.text.link,
  danger: palette.danger.text,
  success: palette.success.text,
  warning: palette.warning.text,
};

/**
 * With per-weight font files, the family (not `fontWeight`) sets the visual
 * weight on native. When a screen overrides `weight`, swap to the matching
 * family in the same family group (Poppins for headings, Inter for the rest).
 */
function familyForWeight(variant: Variant, weight: string): string {
  const isHeading =
    variant.startsWith("display") ||
    variant === "h1" ||
    variant === "h2" ||
    variant === "h3" ||
    variant === "h4";
  if (isHeading) return Number(weight) >= 700 ? fonts.display : fonts.heading;
  const w = Number(weight);
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.bodyMedium;
  return fonts.bodyRegular;
}

/**
 * How far each role is allowed to grow when the OS text size is turned up.
 *
 * THIS IS NOT AN ACCESSIBILITY OPT-OUT — read before changing it.
 *
 * React Native's `<Text>` has `allowFontScaling: true` by default, so every
 * label in this app already scales with the OS setting. What it does NOT have
 * is a ceiling: at iOS's largest accessibility size React multiplies the font
 * by 3.571 (its own table in RCTAccessibilityManager, more aggressive than
 * UIKit's own ~3.1). That turns a 13px row label into 46px inside a 44px row,
 * and since RN 0.85 text overflowing a rounded corner is CLIPPED rather than
 * spilled — so it doesn't look broken, it silently disappears.
 *
 * So the choice isn't "scale or don't". It's "scale into a readable layout" vs
 * "scale into an invisible one". Body copy — the stuff someone with low vision
 * actually needs bigger — is left uncapped and lives in containers that grow.
 * Chrome that sits in a fixed slot (tab labels, chips, table headers, eyebrows)
 * is capped, because past that point it is clipped and helps nobody.
 *
 * React Native core reached the same conclusion for LogBox in v0.87 and settled
 * on 1.5 as "the highest possible value without breaking the UI".
 */
const MAX_SCALE: Partial<Record<Variant, number>> = {
  // Fixed-slot chrome — clipped rather than useful beyond this.
  overline: 1.3,
  "label-sm": 1.4,
  caption: 1.5,
  // Row titles and control labels: they sit in minHeight rows that grow, but
  // not without limit.
  label: 1.6,
  "label-lg": 1.6,
  h4: 1.6,
  h3: 1.6,
  // Big figures are already large; scaling them 3.5x only steals room from the
  // labels that say what they mean.
  "display-sm": 1.5,
  "display-md": 1.5,
  "display-lg": 1.5,
  // body, body-sm, body-lg, h1, h2 are deliberately ABSENT = uncapped. These
  // carry the actual content — medicine names, hints, page titles — and must be
  // allowed to reach 200%+ for WCAG 1.4.4.
};

export function Text({
  variant = "body",
  tone = "primary",
  weight,
  align,
  numberOfLines,
  adjustsFontSizeToFit,
  maxFontSizeMultiplier,
  style,
  children,
}: Props) {
  const base = variantMap[variant];
  return (
    <RNText
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      // An explicit prop wins; otherwise the role's ceiling; otherwise none.
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_SCALE[variant]}
      style={[
        base,
        { color: toneMap[tone] },
        weight
          ? { fontWeight: weight, fontFamily: familyForWeight(variant, weight) }
          : undefined,
        align ? { textAlign: align } : undefined,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
