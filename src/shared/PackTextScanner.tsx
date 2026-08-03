import React, { useRef, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Camera as CameraIcon, ScanText } from "lucide-react-native";
import { ocrApi } from "@modules/inventory/api/ocrApi";
import { PackRead, PackBatchMatch } from "@modules/inventory/types";
import { apiErrorMessage } from "@api/apiClient";
import { scanFeedback } from "@shared/scanFeedback";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button, StatusChip } from "@shared/ui";

interface Props {
  onPicked: (match: PackBatchMatch) => void;
  onClose: () => void;
}

/**
 * Reads the printed panel on a medicine pack and resolves it to a stock lot.
 *
 * This exists because a barcode scanner is useless here: Indian strips print
 * "BATCH NO.PFT6160S" as ink, and where a barcode does appear it identifies the
 * product, never the lot. So we photograph the panel and read the characters.
 *
 * The result is always CONFIRMED before it's used. OCR on curved foil misreads
 * O/0 and S/5 often enough that auto-selecting a near-match would eventually
 * sell from the wrong lot — wrong expiry, wrong MRP, wrong stock decremented.
 * A second of confirmation is cheaper than that.
 */
export function PackTextScanner({ onPicked, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PackRead | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const send = async (uri: string, mimeType = "image/jpeg") => {
    setBusy(true);
    setError(null);
    try {
      const res = await ocrApi.readPack({ uri, name: "pack.jpg", mimeType });
      setResult(res);
      // An exact hit needs no decision — take it and get out of the way.
      if (res.match) {
        scanFeedback("ok");
        onPicked(res.match);
      } else {
        // Read something, but it needs confirming — a different sound, because
        // the user is about to be asked a question rather than moved along.
        scanFeedback(res.candidates.length ? "warn" : "error");
      }
    } catch (e) {
      scanFeedback("error");
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.7,
      // The panel is small text; downscaling past this loses the batch number.
      imageType: "jpg",
    });
    if (photo?.uri) {
      setPreview(photo.uri);
      void send(photo.uri);
    }
  };

  const onWebFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const uri = URL.createObjectURL(f);
    setPreview(uri);
    void send(uri, f.type || "image/jpeg");
  };

  const retry = () => {
    setResult(null);
    setPreview(null);
    setError(null);
  };

  const isWeb = Platform.OS === "web";
  const canShoot = !isWeb && permission?.granted;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <HStack align="center" gap={10} style={{ marginBottom: 12 }}>
            <View style={styles.icon}>
              <ScanText size={18} color={palette.teal[700]} strokeWidth={2} />
            </View>
            <VStack gap={1} flex={1}>
              <Text variant="h4" tone="primary">
                Read batch from pack
              </Text>
              <Text variant="caption" tone="tertiary">
                Fill the frame with the printed BATCH / EXP panel
              </Text>
            </VStack>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <X size={18} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          {/* ---- capture ---- */}
          {!result && !busy && (
            <VStack gap={12}>
              {canShoot ? (
                <View style={styles.cameraBox}>
                  <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                  />
                </View>
              ) : null}

              {!isWeb && !permission?.granted ? (
                <Button
                  label="Allow camera"
                  onPress={() => void requestPermission()}
                />
              ) : null}

              {canShoot ? (
                <Button
                  label="Capture"
                  icon={
                    <CameraIcon size={18} color="#FFFFFF" strokeWidth={2} />
                  }
                  onPress={() => void shoot()}
                />
              ) : null}

              {isWeb ? (
                <>
                  {/* Web has no reliable still-capture across browsers, so use
                      the OS camera/file picker — on a phone browser this opens
                      the camera directly. */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={onWebFile}
                  />
                  <Button
                    label="Take a photo of the pack"
                    icon={
                      <CameraIcon size={18} color="#FFFFFF" strokeWidth={2} />
                    }
                    onPress={() => fileRef.current?.click()}
                  />
                </>
              ) : null}
            </VStack>
          )}

          {busy && (
            <VStack gap={12} align="center" style={{ paddingVertical: 24 }}>
              {preview ? (
                <Image source={{ uri: preview }} style={styles.preview} />
              ) : null}
              <ActivityIndicator color={palette.teal[600]} />
              <Text variant="body-sm" tone="tertiary">
                Reading the pack…
              </Text>
            </VStack>
          )}

          {/* ---- result ---- */}
          {result && !busy && (
            <VStack gap={12}>
              <View style={styles.readBox}>
                <Text variant="caption" tone="tertiary">
                  Read from the pack
                </Text>
                <Text variant="label-lg" tone="primary">
                  {result.read.batchNumber || "— no batch number legible —"}
                </Text>
                <HStack gap={6} wrap style={{ marginTop: 6 }}>
                  {result.read.expiryDate ? (
                    <StatusChip
                      label={`Exp ${result.read.expiryDate}`}
                      tone="neutral"
                    />
                  ) : null}
                  {result.read.mrp ? (
                    <StatusChip
                      label={`MRP ₹${result.read.mrp}`}
                      tone="neutral"
                    />
                  ) : null}
                </HStack>
              </View>

              {result.message ? (
                <Text variant="body-sm" tone="secondary">
                  {result.message}
                </Text>
              ) : null}

              {/* Near-matches: confirmed by hand, never auto-selected. */}
              {result.candidates.map((c) => (
                <Pressable
                  key={c.batch.id}
                  style={styles.candidate}
                  onPress={() => onPicked(c)}
                >
                  <VStack gap={3} flex={1}>
                    <Text variant="label" tone="primary" numberOfLines={1}>
                      {c.product?.name || "Unknown product"}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      Batch {c.batch.batchNumber}
                      {c.batch.expiryDate
                        ? ` · exp ${String(c.batch.expiryDate).slice(0, 7)}`
                        : ""}
                      {` · ${c.available} in stock`}
                    </Text>
                  </VStack>
                  <HStack gap={6}>
                    {c.batch.expired ? (
                      <StatusChip label="Expired" tone="danger" />
                    ) : null}
                    <Text variant="label" style={{ color: palette.teal[700] }}>
                      Use
                    </Text>
                  </HStack>
                </Pressable>
              ))}

              <Button
                label="Take another photo"
                variant="secondary"
                onPress={retry}
              />
            </VStack>
          )}

          {error ? (
            <Text variant="body-sm" tone="danger" style={{ marginTop: 10 }}>
              {error}
            </Text>
          ) : null}
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
  sheet: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBox: {
    height: 240,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  preview: { width: 120, height: 90, borderRadius: radius.sm },
  readBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.ink[50],
  },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
});
