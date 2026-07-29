/**
 * Skeleton — a gently pulsing placeholder block. Replaces the three ad-hoc
 * loading idioms (bare "Loading…" text, EmptyState-as-spinner, nothing) with a
 * consistent shimmer while data resolves.
 */
import React, { useEffect, useState } from "react";
import { Animated, StyleProp, ViewStyle, DimensionValue } from "react-native";
import { palette, radius } from "../designSystem";

interface Props {
  width?: DimensionValue;
  height?: number;
  rounded?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = "100%",
  height = 14,
  rounded = "sm",
  style,
}: Props) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius[rounded],
          backgroundColor: palette.ink[100],
          opacity,
        },
        style,
      ]}
    />
  );
}
