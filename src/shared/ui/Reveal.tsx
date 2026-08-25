/**
 * Reveal — content arrives rather than appearing.
 *
 * WHY
 * ---
 * Every screen in this app currently blinks into existence: the query resolves
 * and a finished layout replaces a spinner in one frame. That is the single
 * biggest reason the phone build reads as inert next to the consumer pharmacy
 * apps. Those apps are not doing anything clever — content simply fades up a few
 * pixels, in order, and the eye reads that as the page assembling itself.
 *
 * WHAT IT IS NOT
 * --------------
 * It is not a page-mount flourish for its own sake, and it deliberately stops
 * short of the long staggered cascades consumer apps use. The numbers here — a
 * 6px rise over 260ms, 32ms between siblings, capped at eight — are chosen so
 * the last item has landed within about half a second. A pharmacist opens this
 * screen a hundred times a shift; anything they can consciously wait for is a
 * tax, not delight.
 *
 * ACCESSIBILITY
 * -------------
 * Honours "reduce motion". When it is on, children are rendered at their final
 * state on the first frame with no animation at all — not a faster animation.
 * Vestibular triggers are about movement existing, not about its duration.
 */
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

/** Shared across every Reveal so the check runs once, not once per row. */
let reduceMotion: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

function useReduceMotion(): boolean {
  const [value, setValue] = useState(reduceMotion ?? false);

  useEffect(() => {
    let alive = true;
    if (reduceMotion === null) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((on) => {
          reduceMotion = on;
          listeners.forEach((l) => l(on));
        })
        .catch(() => {
          // Unsupported platform — assume motion is welcome.
          reduceMotion = false;
        });
    }
    const listener = (v: boolean) => alive && setValue(v);
    listeners.add(listener);

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (on) => {
        reduceMotion = on;
        listeners.forEach((l) => l(on));
      },
    );

    return () => {
      alive = false;
      listeners.delete(listener);
      sub?.remove?.();
    };
  }, []);

  return value;
}

interface Props {
  children: React.ReactNode;
  /**
   * Position in a list. Multiplied by 32ms and capped, so a 200-row inventory
   * list does not spend six seconds arriving.
   */
  index?: number;
  /** Extra delay in ms, for a block that should follow a previous group. */
  delay?: number;
  style?: ViewStyle;
}

/** Past this, the stagger stops adding delay — see `index`. */
const MAX_STAGGER_STEPS = 8;
const STEP_MS = 32;

export function Reveal({ children, index = 0, delay = 0, style }: Props) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  // A row that scrolls back into view must not replay: the animation belongs to
  // the content arriving, not to the component rendering.
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (reduced) {
      progress.set(1);
      return;
    }
    const stagger = Math.min(index, MAX_STAGGER_STEPS) * STEP_MS + delay;
    progress.set(
      withDelay(
        stagger,
        withTiming(1, {
          duration: 260,
          // Decelerate: fast out of the gate, settling at the end. A linear or
          // symmetric ease reads as mechanical at this distance.
          easing: Easing.out(Easing.cubic),
        }),
      ),
    );
  }, [index, delay, reduced, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 6 }],
  }));

  // With reduced motion there is nothing to animate, so skip the animated node
  // entirely rather than mounting one that never moves.
  if (reduced) return <View style={style}>{children}</View>;

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
