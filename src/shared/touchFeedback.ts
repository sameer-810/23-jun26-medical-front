/**
 * Touch feedback — the physical half of an interaction.
 *
 * WHY THIS EXISTS
 * ---------------
 * The client's complaint about the phone app was that it is not *interactive*,
 * measured against the big consumer pharmacy apps. Read literally — which is how
 * it was meant — that is not a request for more colour. It is that nothing in
 * this app answers a finger. Before this file, `expo-haptics` was imported in
 * exactly one place in a 59-screen product: the barcode scanner. Every other
 * tap in the app — completing a sale, writing off a batch, switching a tab —
 * landed in silence.
 *
 * That matters more here than in most products. A pharmacist bills with the
 * phone in one hand and a strip of tablets in the other, often without looking
 * straight at the screen. A confirmation they can *feel* is the difference
 * between knowing the item was added and checking the list to be sure.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is deliberately not a re-skin. The design system's opening note records the
 * same client rejecting a consumer-app look — "big cards, loose spacing, junior"
 * — and the restraint that replaced it is correct and is kept. Density and
 * responsiveness are not opposites: Linear and Stripe are among the densest
 * interfaces shipping and among the most alive. This adds the second half
 * without touching the first.
 *
 * RULES
 * -----
 *  · Never throws, never blocks. A missing haptics engine (emulator, web, some
 *    Android builds) must degrade to nothing, never to a crash in a checkout.
 *  · Intensity carries meaning. `select` for navigating, `impact` for committing
 *    something, `success`/`warning`/`error` for outcomes. A phone that buzzes
 *    identically for everything is noise, and users turn it off.
 *  · Honour the OS. Reduced-motion and silent-mode users have asked for less;
 *    `setHapticsEnabled(false)` exists so a setting can turn it off outright.
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
 * Web vibration durations, in ms.
 *
 * `navigator.vibrate` is Android-Chrome only — iOS Safari has never supported
 * it and desktop browsers ignore it. That is fine: this is a progressive
 * enhancement, and the same call is a no-op everywhere else rather than a
 * feature detection branch at every call site.
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
