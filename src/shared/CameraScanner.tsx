import React, { useEffect, useRef, useState } from "react";
import { View, Modal, Pressable, StyleSheet, Platform } from "react-native";
import { X, Camera as CameraIcon } from "lucide-react-native";
import { palette, radius } from "@shared/designSystem";
import { Text, Button } from "@shared/ui";

/**
 * Camera barcode scanner for the web app — turns a phone/tablet camera into a
 * scanner so a pharmacy without a USB gun can still ring up sales or capture
 * barcodes. A detected code is handed to `onDetected`, which feeds the SAME
 * resolve flow as a USB scan.
 *
 * Two engines, picked automatically:
 *  - `BarcodeDetector` — native & fast, on Chrome (Android / desktop);
 *  - `@zxing/browser` — a JS decoder loaded lazily as the fallback for browsers
 *    without it (notably iOS Safari), so iPhones work too.
 */

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "codabar",
  "qr_code",
];

const detectorSupported = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window;

type ZxingControls = { stop: () => void };

interface Props {
  visible: boolean;
  onDetected: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export function CameraScanner({
  visible,
  onDetected,
  onClose,
  title = "Scan barcode",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zxingRef = useRef<ZxingControls | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<null | "scanning" | "error">(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Keep the latest callback so the scan loop never needs the effect re-bound.
  const detectedRef = useRef(onDetected);
  useEffect(() => {
    detectedRef.current = onDetected;
  });

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    doneRef.current = false;
    let cancelled = false;

    function stopAll() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (zxingRef.current) {
        try {
          zxingRef.current.stop();
        } catch {
          /* already stopped */
        }
        zxingRef.current = null;
      }
    }

    function hit(raw: string) {
      const code = String(raw || "").trim();
      if (!code || doneRef.current) return;
      doneRef.current = true;
      stopAll();
      detectedRef.current(code);
    }

    (async () => {
      // Deferred (after an await) so this isn't a synchronous effect setState.
      await Promise.resolve();
      if (cancelled) return;
      setStatus(null);
      setErrorMsg("");
      try {
        if (detectorSupported()) {
          // ---- Native BarcodeDetector path -------------------------------
          const detector = new (
            window as unknown as {
              BarcodeDetector: new (o: unknown) => {
                detect: (v: unknown) => Promise<{ rawValue?: string }[]>;
              };
            }
          ).BarcodeDetector({ formats: FORMATS });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          setStatus("scanning");
          timerRef.current = setInterval(async () => {
            if (doneRef.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes?.[0]?.rawValue) hit(codes[0].rawValue);
            } catch {
              /* frame not ready — try next tick */
            }
          }, 250);
        } else {
          // ---- zxing fallback (iOS Safari & anything without BarcodeDetector)
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled || !videoRef.current) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } } },
            videoRef.current,
            (result) => {
              if (result) hit(result.getText());
            },
          );
          if (cancelled) {
            controls.stop();
            return;
          }
          zxingRef.current = controls;
          setStatus("scanning");
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setStatus("error");
        setErrorMsg(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in the browser and try again."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "Couldn't start the camera. Make sure the page is on HTTPS and no other app is using the camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [visible]);

  if (!visible) return null;

  const native = Platform.OS !== "web";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text variant="label-lg" tone="primary">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close scanner"
            >
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.viewport}>
            {native ? (
              <View style={styles.msg}>
                <CameraIcon
                  size={28}
                  color={palette.text.tertiary}
                  strokeWidth={1.6}
                />
                <Text
                  variant="body-sm"
                  tone="tertiary"
                  style={{ textAlign: "center", marginTop: 10 }}
                >
                  Camera scanning is available in the web app.
                </Text>
              </View>
            ) : status === "error" ? (
              <View style={styles.msg}>
                <Text
                  variant="body-sm"
                  tone="danger"
                  style={{ textAlign: "center" }}
                >
                  {errorMsg}
                </Text>
              </View>
            ) : (
              <>
                {React.createElement("video", {
                  ref: videoRef,
                  autoPlay: true,
                  muted: true,
                  playsInline: true,
                  style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  },
                })}
                <View style={styles.frame} />
              </>
            )}
          </View>

          {!native && status !== "error" ? (
            <Text
              variant="caption"
              tone="tertiary"
              style={{ textAlign: "center", marginTop: 10 }}
            >
              {status === "scanning"
                ? "Point the camera at the barcode on the pack"
                : "Starting camera…"}
            </Text>
          ) : null}

          <Button
            label="Cancel"
            variant="secondary"
            onPress={onClose}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.default,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  viewport: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#000",
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  frame: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "28%",
    bottom: "28%",
    borderWidth: 2,
    borderColor: palette.teal[400],
    borderRadius: radius.sm,
    pointerEvents: "none",
  },
  msg: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
