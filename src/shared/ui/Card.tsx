import React from "react";
import { ViewStyle, StyleProp, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { palette, radius, shadows, outline, motion } from "../designSystem";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Elevation = "base" | "raised" | "floating" | "overlay";
// Resting cards are flat (hairline border only) — the modern/clinical look.
// Real shadow is reserved for genuinely floating surfaces (menus, dialogs).
const ELEV: Record<Elevation, object> = {
  base: shadows.none,
  raised: shadows.xs,
  floating: shadows.md,
  overlay: shadows.lg,
};

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevation?: Elevation;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  onPress,
  padded = true,
  elevation: level = "base",
  style,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const base: ViewStyle = {
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    borderColor: outline.color,
    padding: padded ? 16 : 0,
    ...ELEV[level],
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => scale.set(withSpring(0.985, motion.spring.crisp))}
        onPressOut={() => scale.set(withSpring(1, motion.spring.gentle))}
        style={[base, style, animStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  }
  return <Animated.View style={[base, style]}>{children}</Animated.View>;
}
