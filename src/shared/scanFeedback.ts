import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
 * Web synthesises them through an oscillator; native plays .wav files generated
 * from the SAME frequencies, durations and envelope, so a counter can't tell
 * which platform the till is running. The tones were originally web-only on the
 * theory that synthesis avoided shipping assets — which quietly meant a phone
 * produced no sound at all, only a vibration.
 */
export type ScanTone = "ok" | "error" | "warn";

const TONES: Record<ScanTone, { freq: number; ms: number; repeat: number }> = {
  ok: { freq: 1320, ms: 90, repeat: 1 },
  error: { freq: 220, ms: 180, repeat: 2 },
  warn: { freq: 660, ms: 130, repeat: 1 },
};

const MUTE_KEY = "scanMuted";
let ctx: AudioContext | null = null;
let muted = false;

async function readMutePref(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(MUTE_KEY) === "1";
    return (await AsyncStorage.getItem(MUTE_KEY)) === "1";
  } catch {
    return false;
  }
}

/**
 * Hydrates the in-memory flag once, at import.
 *
 * The reader below is synchronous because callers use it for a toggle's initial
 * state, but native storage is async — so on a phone the preference used to
 * reset to "unmuted" on every launch while the comment claimed it persisted.
 */
export const scanSoundReady: Promise<void> = readMutePref().then((v) => {
  muted = v;
});

/** Counters get loud; some want it off. Persisted so it survives a restart. */
export function setScanSoundMuted(next: boolean) {
  muted = next;
  const value = next ? "1" : "0";
  try {
    if (Platform.OS === "web") localStorage.setItem(MUTE_KEY, value);
    else void AsyncStorage.setItem(MUTE_KEY, value).catch(() => {});
  } catch {
    // Private-mode browsers throw on localStorage; muting just won't persist.
  }
}

export function isScanSoundMuted() {
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

/** One reusable player per tone; scans come in bursts, so re-creating is waste. */
type NativePlayer = { play: () => void; seekTo: (seconds: number) => void };
const players: Partial<Record<ScanTone, NativePlayer>> = {};
let audioModeReady = false;

async function nativeBeep(tone: ScanTone) {
  const audio = await import("expo-audio");

  if (!audioModeReady) {
    audioModeReady = true;
    // A pharmacy phone lives on silent. Without this the confirmation tone —
    // the entire point of the feature — is inaudible on iOS.
    await audio
      .setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      })
      .catch(() => {});
  }

  let player = players[tone];
  if (!player) {
    const source =
      tone === "ok"
        ? require("../../assets/sounds/scan-ok.wav")
        : tone === "error"
          ? require("../../assets/sounds/scan-error.wav")
          : require("../../assets/sounds/scan-warn.wav");
    player = audio.createAudioPlayer(source) as unknown as NativePlayer;
    players[tone] = player;
  }
  // Rewind first: scanning five packs in a row must beep five times, and a
  // finished player sits at the end of the clip.
  player.seekTo(0);
  player.play();
}

async function nativeFeedback(tone: ScanTone) {
  // Sound and vibration are independent — a failure in one must not mute the
  // other, which is why these are two separate try blocks rather than one.
  try {
    await nativeBeep(tone);
  } catch {
    // No audio engine available — the haptic below still lands.
  }
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
