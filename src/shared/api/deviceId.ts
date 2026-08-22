/**
 * Stable per-install device identifier for the concurrent-device limit.
 * Generated once and persisted (SecureStore on native, localStorage on web) so
 * the backend can tell one physical device apart from another. Re-installing
 * the app produces a new id (counts as a new device) — that's expected.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "medstock-device-id";
let cached: string | null = null;

function genId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function read(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(KEY)
      : null;
  }
  return SecureStore.getItemAsync(KEY);
}

async function write(value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

/** Returns the persisted device id, generating and storing one on first use. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await read().catch(() => null);
  if (!id) {
    id = genId();
    await write(id).catch(() => {});
  }
  cached = id;
  return id;
}

/**
 * The label shown in "Devices you're signed in on".
 *
 * `Platform.OS` alone produced "web" for the counter PC, the tablet and the
 * owner's laptop alike, so the one list that exists to tell devices apart told
 * you nothing. On web the browser and OS are read off the user-agent; a
 * pharmacy runs a counter desktop and a couple of phones, and "Windows ·
 * Chrome" against "Android" is enough to know which slot to free.
 */
export function getDeviceName(): string {
  if (Platform.OS !== "web") {
    return Platform.OS === "ios" ? "iPhone / iPad" : "Android device";
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (!ua) return "Browser";

  // Order matters: Edge and Opera both claim Chrome, Chrome claims Safari.
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";

  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "Mac"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";

  return os ? `${os} · ${browser}` : browser;
}
