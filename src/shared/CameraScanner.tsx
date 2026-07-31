import React, { useEffect, useRef, useState } from "react";
import { View, Modal, Pressable, StyleSheet, Platform } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeType } from "expo-camera";
import { X, Camera as CameraIcon } from "lucide-react-native";
import { palette, radius } from "@shared/designSystem";
import { Text, Button } from "@shared/ui";

/**
 * Barcode scanner that works EVERYWHERE the app runs:
 *  - Native app (Android/iOS APK): expo-camera `CameraView` live scanning;
 *  - Web on Chrome (Android/desktop): the browser's native `BarcodeDetector`;
 *  - Web on iOS Safari / no BarcodeDetector: `@zxing/browser` (loaded lazily).
 * A detected code is handed to `onDetected`, feeding the SAME resolve flow as a
 * USB scan — so pharmacies without a scanner gun can use a phone camera instead.
 */

// Web BarcodeDetector format hints.
const WEB_FORMATS = [
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
// expo-camera barcode types (native).
const NATIVE_FORMATS: BarcodeType[] = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "itf14",
  "codabar",
  "qr",
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
  const isWeb = Platform.OS === "web";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zxingRef = useRef<ZxingControls | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<null | "scanning" | "error">(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [permission, requestPermission] = useCameraPermissions();

  // Keep the latest callback so the scan loop never needs the effect re-bound.
  const detectedRef = useRef(onDetected);
  useEffect(() => {
    detectedRef.current = onDetected;
  });

  // Fresh scan each time the sheet opens.
  useEffect(() => {
    if (visible) doneRef.current = false;
  }, [visible]);

  // ---- Web engines (BarcodeDetector → zxing fallback) ----------------------
  useEffect(() => {
    if (!visible || !isWeb) return;
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
      await Promise.resolve(); // defer so this isn't a synchronous effect setState
      if (cancelled) return;
      setStatus(null);
      setErrorMsg("");
      try {
        if (detectorSupported()) {
          const detector = new (
            window as unknown as {
              BarcodeDetector: new (o: unknown) => {
                detect: (v: unknown) => Promise<{ rawValue?: string }[]>;
              };
            }
          ).BarcodeDetector({ formats: WEB_FORMATS });
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
              /* frame not ready */
            }
          }, 250);
        } else {
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
            ? "Camera permission was denied. Allow camera access and try again."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "Couldn't start the camera. Make sure the page is on HTTPS and no other app is using it.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [visible, isWeb]);

  if (!visible) return null;

  const onNativeScan = (raw: string) => {
    const code = String(raw || "").trim();
    if (!code || doneRef.current) return;
    doneRef.current = true;
    detectedRef.current(code);
  };

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
            {isWeb ? (
              status === "error" ? (
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
              )
            ) : !permission ? (
              <View style={styles.msg}>
                <Text variant="body-sm" tone="tertiary">
                  Checking camera…
                </Text>
              </View>
            ) : !permission.granted ? (
              <View style={styles.msg}>
                <CameraIcon
                  size={28}
                  color={palette.text.tertiary}
                  strokeWidth={1.6}
                />
                <Text
                  variant="body-sm"
                  tone="tertiary"
                  style={{
                    textAlign: "center",
                    marginTop: 10,
                    marginBottom: 12,
                  }}
                >
                  Allow camera access to scan barcodes.
                </Text>
                <Button
                  label="Allow camera"
                  fullWidth={false}
                  onPress={() => void requestPermission()}
                />
              </View>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: NATIVE_FORMATS }}
                  onBarcodeScanned={(e) => onNativeScan(e.data)}
                />
                <View style={styles.frame} />
              </>
            )}
          </View>

          {(isWeb ? status !== "error" : !!permission?.granted) ? (
            <Text
              variant="caption"
              tone="tertiary"
              style={{ textAlign: "center", marginTop: 10 }}
            >
              {isWeb && status !== "scanning"
                ? "Starting camera…"
                : "Point the camera at the barcode on the pack"}
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
