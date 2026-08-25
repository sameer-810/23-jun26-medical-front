import React from "react";
import { ViewStyle, StyleProp, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  palette,
  radius,
  shadows,
  outline,
  motion,
  layout,
} from "../designSystem";
import { haptic, type FeedbackTone } from "../touchFeedback";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Elevation = "base" | "raised" | "floating" | "overlay";
// Resting cards are flat — a hairline on a tinted canvas does the separating.
// Real shadow is reserved for genuinely floating surfaces (menus, dialogs).
const ELEV: Record<Elevation, object> = {
  base: shadows.none,
  raised: shadows.none,
  floating: shadows.md,
  overlay: shadows.lg,
};

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  /** 12px instead of 16 — for cards that are mostly a list of rows. */
  compact?: boolean;
  elevation?: Elevation;
  style?: StyleProp<ViewStyle>;
  /** Haptic on press. A tappable card is navigation, so `select` by default. */
  hapticTone?: FeedbackTone | "none";
}

/**
 * Press depth.
 *
 * This was 0.985 — a 1.5% scale change. On a 360pt-wide card that is a little
 * over 5pt of travel across the whole element, which is below what a person
 * registers as the card having moved at all; the tap looked like nothing
 * happened until the next screen appeared. 0.97 is still far short of the
 * squashy 0.90 consumer apps use, but it is unmistakably a press.
 *
 * Paired with a slight dim, because scale alone on a white card against a white
 * canvas has almost no edge for the eye to track.
 */
const PRESS_SCALE = 0.97;
const PRESS_DIM = 0.9;

export function Card({
  children,
  onPress,
  padded = true,
  compact = false,
  elevation: level = "base",
  style,
  hapticTone = "select",
}: Props) {
  const press = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => {
    const p = press.get();
    return {
      transform: [{ scale: 1 - p * (1 - PRESS_SCALE) }],
      opacity: 1 - p * (1 - PRESS_DIM),
    };
  });

  const base: ViewStyle = {
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    borderColor: outline.color,
    padding: padded
      ? compact
        ? layout.cardPaddingCompact
        : layout.cardPadding
      : 0,
    ...ELEV[level],
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          press.set(withSpring(1, motion.spring.crisp));
          if (hapticTone !== "none") haptic(hapticTone);
        }}
        onPressOut={() => press.set(withSpring(0, motion.spring.gentle))}
        style={[base, style, animStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  }
  return <Animated.View style={[base, style]}>{children}</Animated.View>;
}
