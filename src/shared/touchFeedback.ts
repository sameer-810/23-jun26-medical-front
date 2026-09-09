/**
 * Touch feedback — the physical half of an interaction.
 *
 * The client said the phone app was not *interactive*. Before this file,
 * `expo-haptics` was imported in one place across 59 screens (the scanner);
 * every other tap — completing a sale, writing off a batch — landed in
 * silence. A pharmacist bills with the phone in one hand and a strip in the
 * other, often without looking straight at it, so a confirmation they can feel
 * is the difference between knowing and checking.
 *
 * NOT a re-skin: the design system's restraint ("big cards, loose spacing,
 * junior" was the rejected version) stays. Density and responsiveness are not
 * opposites.
 *
 * Rules:
 *  · Never throws, never blocks — a missing haptics engine degrades to
 *    nothing, never to a crash in a checkout.
 *  · Intensity carries meaning: `select` to navigate, `impact` to commit,
 *    `success`/`warning`/`error` for outcomes. Identical buzzing is noise.
 *  · Honour the OS, and `setHapticsEnabled(false)` turns it off outright.
 */
import { Platform } from "react-native";

export type FeedbackTone =
  /** Moving between things — tab change, chip select, row focus. The lightest tick. */
  | "select"
  /** Committing something small — add to cart, toggle, stepper. */
  | "impact"
  /** A heavier commit — completing a sale, submitting a form. */
  | "heavy"
  /** Outcomes. */
  | "success"
  | "warning"
  | "error";

let enabled = true;

/** Turn all haptics off (a user setting, or a test run). */
export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function hapticsEnabled() {
  return enabled;
}

/**
 * Web vibration durations, in ms. `navigator.vibrate` is Android-Chrome only —
 * a no-op everywhere else, which is why this is a progressive enhancement
 * rather than a feature-detection branch at every call site.
 */
const WEB_PATTERN: Record<FeedbackTone, number | number[]> = {
  select: 8,
  impact: 14,
  heavy: 22,
  success: [12, 40, 18],
  warning: [18, 50, 18],
  error: [24, 60, 24, 60, 24],
};

function webFeedback(tone: FeedbackTone) {
  try {
    const nav = globalThis.navigator as Navigator | undefined;
    nav?.vibrate?.(WEB_PATTERN[tone]);
  } catch {
    // Blocked by permissions policy, or no vibration hardware. Nothing to do.
  }
}

async function nativeFeedback(tone: FeedbackTone) {
  try {
    // Lazily imported so the module graph stays free of the native dependency
    // on web, matching how scanFeedback.ts loads it.
    const H = await import("expo-haptics");
    switch (tone) {
      case "select":
        await H.selectionAsync();
        return;
      case "impact":
        await H.impactAsync(H.ImpactFeedbackStyle.Light);
        return;
      case "heavy":
        await H.impactAsync(H.ImpactFeedbackStyle.Medium);
        return;
      case "success":
        await H.notificationAsync(H.NotificationFeedbackType.Success);
        return;
      case "warning":
        await H.notificationAsync(H.NotificationFeedbackType.Warning);
        return;
      case "error":
        await H.notificationAsync(H.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // No haptics engine. The visual feedback still lands.
  }
}

/**
 * Fire a haptic. Safe to call from anywhere, including render-adjacent code and
 * gesture worklets' JS callbacks; it never throws and never awaits the caller.
 */
export function haptic(tone: FeedbackTone = "select") {
  if (!enabled) return;
  if (Platform.OS === "web") webFeedback(tone);
  else void nativeFeedback(tone);
}
