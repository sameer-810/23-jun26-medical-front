import { useRef, useState, useCallback } from "react";
import { Platform } from "react-native";

export interface CapturedImage {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * One way to get a photo out of a user, on every platform we ship.
 *
 * Native gets `expo-image-picker`'s camera; web gets a hidden file input with
 * `capture="environment"`, which a phone browser opens straight into the camera
 * and a desktop browser turns into a file picker. Both end at the same
 * `{uri, name, mimeType}` the upload helpers already take.
 *
 * Deliberately not a component: the pack reader wants an inline preview, the
 * cheque form wants a button in a row, and a shared modal would fit neither.
 */
export function useImageCapture() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resolver = useRef<((img: CapturedImage | null) => void) | null>(null);
  const [busy, setBusy] = useState(false);

  const onWebFile = useCallback(
    (e: { target: { files?: FileList | null } }) => {
      const f = e.target.files?.[0];
      const done = resolver.current;
      resolver.current = null;
      if (!f || !done) return done?.(null);
      done({
        uri: URL.createObjectURL(f),
        name: f.name || "capture.jpg",
        mimeType: f.type || "image/jpeg",
      });
    },
    [],
  );

  /** Opens the camera (or picker) and resolves with the photo, or null. */
  const capture = useCallback(async (): Promise<CapturedImage | null> => {
    if (Platform.OS === "web") {
      return new Promise((resolve) => {
        resolver.current = resolve;
        // Reset first, or picking the same file twice fires no change event.
        if (inputRef.current) inputRef.current.value = "";
        inputRef.current?.click();
      });
    }

    setBusy(true);
    try {
      const picker = await import("expo-image-picker");
      const perm = await picker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
      const res = await picker.launchCameraAsync({
        quality: 0.75,
        // The server compresses anyway; this just keeps the upload sane on a
        // counter's mobile connection.
        allowsEditing: false,
      });
      if (res.canceled || !res.assets?.[0]) return null;
      const a = res.assets[0];
      return {
        uri: a.uri,
        name: a.fileName || "capture.jpg",
        mimeType: a.mimeType || "image/jpeg",
      };
    } finally {
      setBusy(false);
    }
  }, []);

  return { capture, busy, inputRef, onWebFile };
}
