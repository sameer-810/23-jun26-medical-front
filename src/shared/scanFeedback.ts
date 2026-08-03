import { Platform } from "react-native";

/**
 * Audible/tactile confirmation for scans.
 *
 * Why this exists even though barcode guns already beep: the gun's beep means
 * "I decoded a barcode". It says nothing about whether the sale accepted it. A
 * gun beeps just as cheerfully at a lot that expired last month or has nothing
 * left on the shelf. The cashier is looking at the pack, not the screen, so the
 * only signal that carries the real answer is this one — and it has to SOUND
 * different when the answer is no.
 *
 * Three distinct tones, chosen to be told apart in a noisy shop without
 * looking: a short high blip for accepted, a low double buzz for rejected, and
 * a mid tone for "read it, but you need to check something".
 *
 * Synthesised rather than bundled as audio files: no assets to ship, no
 * licensing, no decode latency, and nothing to rebuild the APK for.
 */
export type ScanTone = "ok" | "error" | "warn";

const TONES: Record<ScanTone, { freq: number; ms: number; repeat: number }> = {
  ok: { freq: 1320, ms: 90, repeat: 1 },
  error: { freq: 220, ms: 180, repeat: 2 },
  warn: { freq: 660, ms: 130, repeat: 1 },
};

let ctx: AudioContext | null = null;
let muted = false;

/** Counters get loud; some want it off. Persisted so it survives a reload. */
export function setScanSoundMuted(next: boolean) {
  muted = next;
  try {
    if (Platform.OS === "web")
      localStorage.setItem("scanMuted", next ? "1" : "0");
  } catch {
    // Private-mode browsers throw on localStorage; muting just won't persist.
  }
}

export function isScanSoundMuted() {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem("scanMuted") === "1";
    } catch {
      return muted;
    }
  }
  return muted;
}

function webBeep(tone: ScanTone) {
  const { freq, ms, repeat } = TONES[tone];
  try {
    // Created lazily: browsers refuse an AudioContext before a user gesture,
    // and the first scan is always preceded by one.
    ctx =
      ctx ||
      new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    if (ctx.state === "suspended") void ctx.resume();

    for (let i = 0; i < repeat; i++) {
      const start = ctx.currentTime + i * ((ms + 60) / 1000);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square"; // cuts through shop noise better than a sine
      osc.frequency.value = freq;
      // Ramp the edges — a hard start/stop clicks.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + ms / 1000 + 0.02);
    }
  } catch {
    // Audio is a convenience, never a dependency — a blocked or unsupported
    // AudioContext must not break scanning.
  }
}

async function nativeFeedback(tone: ScanTone) {
  try {
    const Haptics = await import("expo-haptics");
    const style =
      tone === "ok"
        ? Haptics.NotificationFeedbackType.Success
        : tone === "warn"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error;
    await Haptics.notificationAsync(style);
  } catch {
    // No haptics engine (emulator, some Android builds) — silently skip.
  }
}

/** Signal the outcome of a scan. Safe to call from anywhere; never throws. */
export function scanFeedback(tone: ScanTone) {
  if (isScanSoundMuted()) return;
  if (Platform.OS === "web") webBeep(tone);
  else void nativeFeedback(tone);
}
