import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { palette, radius, shadows } from "../designSystem";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  onPress: () => void;
  icon: React.ReactNode;
  /** Spoken name — an icon-only control has no text for a screen reader. */
  label?: string;
}

/** Fab — clinical floating action button: teal circle, soft elevation. */
export function Fab({ onPress, icon, label }: Props) {
  const press = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.get() * 0.06 }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={() => press.set(withTiming(1, { duration: 80 }))}
        onPressOut={() => press.set(withTiming(0, { duration: 140 }))}
        style={[styles.fab, animStyle]}
      >
        {icon}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 24, bottom: 28 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: palette.teal[700],
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lg,
  },
});
