import React, { useState } from "react";
import {
  View,
  Image,
  ActivityIndicator,
  Pressable,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Camera,
  ImageIcon,
  FileText,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Maximize2,
  X,
} from "lucide-react-native";
import { ocrApi, ScanFile } from "@modules/inventory/api/ocrApi";
import {
  Rotation,
  renderUpright,
  suggestRotation,
  turn,
} from "@modules/inventory/billImage";
import { ScannedBill, ScannedLine } from "@modules/inventory/types";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
} from "@shared/ui";

/** "2028-01" -> "Jan 2028" for a quick human read. */
const prettyExpiry = (e: string | null) => {
  if (!e) return "—";
  const [y, m] = e.split("-");
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${months[Number(m) - 1] || m} ${y}`;
};

export default function ScanBillScreen() {
  const navigation = useNavigation<never>();
  const nav = navigation as unknown as {
    navigate: (s: string, p?: object) => void;
    goBack: () => void;
  };
  /** The image as picked. Kept so every turn renders from the original. */
  const [original, setOriginal] = useState<string | null>(null);
  /** What's on screen and what will be uploaded — the same bytes, always. */
  const [preview, setPreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [turning, setTurning] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [bill, setBill] = useState<ScannedBill | null>(null);
  // Judging orientation needs a big picture: a bill shrunk into a card is a grey
  // smudge, and asking someone to confirm what they can't read is theatre.
  const { width } = useWindowDimensions();
  const previewHeight = width >= 900 ? 440 : 260;

  const scan = useMutation({
    mutationFn: ({
      file,
      orientationConfirmed,
    }: {
      file: ScanFile;
      orientationConfirmed: boolean;
    }) => ocrApi.scanPurchaseBill(file, orientationConfirmed),
    onSuccess: setBill,
  });

  const reset = () => {
    setBill(null);
    setPrepError(null);
    scan.reset();
  };

  /** Show the picked photo the way we think it should sit, ready to correct. */
  const stage = async (uri: string, width?: number, height?: number) => {
    reset();
    setOriginal(uri);
    setPreview(null);
    await bake(uri, suggestRotation(width, height));
  };

  /** Render `uri` at `rot` and show it. The preview IS the upload. */
  const bake = async (uri: string, rot: Rotation) => {
    setTurning(true);
    setPrepError(null);
    try {
      setPreview(await renderUpright(uri, rot));
      setRotation(rot);
    } catch {
      // Without a rendered image we can't honestly claim the orientation was
      // checked, so don't silently fall back to uploading the raw file.
      setPreview(null);
      setPrepError(
        "Could not open that image. Try another photo, or upload the bill as a PDF.",
      );
    } finally {
      setTurning(false);
    }
  };

  const rotate = (dir: 1 | -1) => {
    if (!original) return;
    void bake(original, turn(rotation, dir));
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    void stage(a.uri, a.width, a.height);
  };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    void stage(a.uri, a.width, a.height);
  };

  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];

    // An image picked as a file still needs squaring up; a PDF is already
    // upright and digital, so it goes straight through. The file picker doesn't
    // report dimensions, so there's no opening guess here — the preview starts
    // as-is and the pharmacist turns it.
    if (a.mimeType?.startsWith("image/")) {
      void stage(a.uri);
      return;
    }
    reset();
    setOriginal(null);
    setPreview(null);
    scan.mutate({
      file: {
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType || "application/pdf",
      },
      orientationConfirmed: false,
    });
  };

  /**
   * Send the reviewed pixels. `orientationConfirmed` is only ever true here:
   * this is the one code path where a human has actually looked at the page.
   */
  const scanNow = () => {
    if (!preview) return;
    setBill(null);
    scan.mutate({
      file: { uri: preview, name: "bill.jpg", mimeType: "image/jpeg" },
      orientationConfirmed: true,
    });
  };

  /** Hands the draft to Receive Stock, which pre-fills its form. */
  const useLines = () => {
    if (!bill) return;
    nav.navigate("ReceiveStock", { scanned: bill });
  };

  return (
    <Screen
      overline="Stock Inward"
      title="Scan a bill"
      subtitle="Photo, gallery or PDF — we read it, you confirm"
    >
      {/* Sources */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={12}>
          <HStack gap={10} wrap>
            <Button
              label="Take photo"
              fullWidth={false}
              onPress={takePhoto}
              icon={<Camera size={17} color="#FFFFFF" strokeWidth={2} />}
            />
            <Button
              label="From gallery"
              variant="secondary"
              fullWidth={false}
              onPress={pickImage}
              icon={
                <ImageIcon
                  size={17}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              }
            />
            <Button
              label="PDF / file"
              variant="secondary"
              fullWidth={false}
              onPress={pickPdf}
              icon={
                <FileText
                  size={17}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              }
            />
          </HStack>
          <Text variant="caption" tone="tertiary">
            Lay the bill flat in good light. Sideways photos are fine — you turn
            it the right way up on the next step.
          </Text>
        </VStack>
      </Card>

      {prepError && (
        <View style={errBox}>
          <Text variant="body-sm" tone="danger">
            {prepError}
          </Text>
        </View>
      )}

      {/* Square the page up before reading it. The pharmacist does this in a
          glance; the server would need an extra OCR call to guess it, and would
          have to finish guessing before it could start reading. */}
      {preview && !scan.isPending && !bill && (
        <Card style={{ marginBottom: 16 }}>
          <VStack gap={12}>
            <Pressable
              onPress={() => setZoomed(true)}
              accessibilityLabel="Enlarge bill preview"
            >
              <Image
                source={{ uri: preview }}
                style={{
                  width: "100%",
                  height: previewHeight,
                  borderRadius: radius.lg,
                  backgroundColor: palette.ink[100],
                }}
                resizeMode="contain"
              />
              <View style={zoomHint}>
                <Maximize2 size={13} color="#FFFFFF" strokeWidth={2.2} />
                <Text variant="label-sm" style={{ color: "#FFFFFF" }}>
                  Tap to enlarge
                </Text>
              </View>
            </Pressable>
            <HStack gap={10} align="center" wrap>
              <TurnButton
                label="Rotate left"
                onPress={() => rotate(-1)}
                disabled={turning}
                icon={
                  <RotateCcw
                    size={18}
                    color={palette.text.primary}
                    strokeWidth={2}
                  />
                }
              />
              <TurnButton
                label="Rotate right"
                onPress={() => rotate(1)}
                disabled={turning}
                icon={
                  <RotateCw
                    size={18}
                    color={palette.text.primary}
                    strokeWidth={2}
                  />
                }
              />
              {turning && <ActivityIndicator color={palette.teal[600]} />}
              <View style={{ flex: 1, minWidth: 160 }}>
                {/* Sideways is the rotation that actually breaks a read; a bill
                    that's merely upside-down reads fine, so don't send anyone
                    hunting for a flip they don't need. */}
                <Text variant="caption" tone="tertiary">
                  The bill should lie flat and wide, like the paper does.
                  Enlarge it if you&apos;re not sure — a sideways bill reads
                  badly.
                </Text>
              </View>
              <Button
                label="Scan bill"
                fullWidth={false}
                disabled={turning}
                onPress={scanNow}
                icon={<ScanLine size={17} color="#FFFFFF" strokeWidth={2} />}
              />
            </HStack>
          </VStack>
        </Card>
      )}

      {scan.isPending && (
        <Card style={{ marginBottom: 16 }}>
          <HStack gap={12} align="center">
            <ActivityIndicator color={palette.teal[600]} />
            <VStack gap={2} flex={1}>
              <Text variant="label-lg" tone="primary">
                Reading the bill…
              </Text>
              <Text variant="caption" tone="tertiary">
                Reading every product, batch, expiry and price. Usually under 10
                seconds.
              </Text>
            </VStack>
          </HStack>
        </Card>
      )}

      {scan.isError && (
        <View style={errBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(scan.error)}
          </Text>
        </View>
      )}

      {bill && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <VStack gap={10}>
              <Text variant="h3" tone="primary">
                {bill.supplierName || "Unknown supplier"}
              </Text>
              <Text variant="caption" tone="tertiary">
                {bill.invoiceNo
                  ? `Invoice ${bill.invoiceNo}`
                  : "No invoice no."}
                {bill.invoiceDate ? ` · ${bill.invoiceDate}` : ""}
              </Text>
              <HStack gap={8} wrap>
                <StatusChip
                  label={`${bill.stats.confident} ready`}
                  tone="success"
                />
                {bill.stats.needsReview > 0 && (
                  <StatusChip
                    label={`${bill.stats.needsReview} to check`}
                    tone="warning"
                  />
                )}
                <StatusChip label={`${bill.stats.total} lines`} tone="info" />
              </HStack>
              {bill.stats.needsReview > 0 && (
                <Text variant="caption" tone="tertiary">
                  Amber lines have something to check — a batch or expiry that
                  looks off, or a product we couldn&apos;t match. Confirm those
                  before saving.
                </Text>
              )}
            </VStack>
          </Card>

          <VStack gap={10}>
            {bill.lines.map((l, i) => (
              <LineCard key={i} line={l} />
            ))}
          </VStack>

          <Button
            label="Use these lines"
            size="lg"
            style={{ marginTop: 16 }}
            onPress={useLines}
            icon={<ArrowRight size={18} color="#FFFFFF" strokeWidth={2} />}
          />
          <Text
            variant="caption"
            tone="tertiary"
            align="center"
            style={{ marginTop: 8 }}
          >
            Nothing is saved yet — you&apos;ll confirm on the Receive Stock
            form.
          </Text>
        </>
      )}

      {/* Full-screen look at the page, with the turn controls still to hand so
          a wrong orientation is fixed where it's actually visible. */}
      <Modal
        visible={zoomed && Boolean(preview)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomed(false)}
      >
        <View style={zoomBackdrop}>
          <Pressable
            onPress={() => setZoomed(false)}
            style={zoomClose}
            accessibilityLabel="Close preview"
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          {preview && (
            <Image
              source={{ uri: preview }}
              style={{ flex: 1, width: "100%" }}
              resizeMode="contain"
            />
          )}
          <HStack gap={12} justify="center" style={{ paddingVertical: 18 }}>
            {/* The button face is white, so the glyph must be dark — white on
                white was invisible against the dimmed backdrop. */}
            <TurnButton
              label="Rotate left in preview"
              onPress={() => rotate(-1)}
              disabled={turning}
              icon={
                <RotateCcw
                  size={18}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              }
            />
            <TurnButton
              label="Rotate right in preview"
              onPress={() => rotate(1)}
              disabled={turning}
              icon={
                <RotateCw
                  size={18}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              }
            />
            {turning && <ActivityIndicator color="#FFFFFF" />}
          </HStack>
        </View>
      </Modal>

      {!bill && !scan.isPending && !preview && (
        <Card>
          <VStack gap={8} align="center" style={{ paddingVertical: 20 }}>
            <ScanLine size={30} color={palette.teal[600]} strokeWidth={1.8} />
            <Text variant="label-lg" tone="primary">
              No bill scanned yet
            </Text>
            <Text variant="caption" tone="tertiary" align="center">
              Snap the distributor&apos;s invoice and we&apos;ll pull out every
              product, batch and expiry.
            </Text>
          </VStack>
        </Card>
      )}
    </Screen>
  );
}

/** Square icon button for the quarter-turn controls. */
function TurnButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        turnBtn,
        pressed && { backgroundColor: palette.ink[100] },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon}
    </Pressable>
  );
}

function LineCard({ line }: { line: ScannedLine }) {
  const ok = !line.needsReview;
  return (
    <Card
      elevation="base"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: ok ? palette.success.text : palette.warning.text,
      }}
    >
      <VStack gap={8}>
        <HStack align="center" justify="space-between" gap={8}>
          <HStack gap={7} align="center" flex={1}>
            {ok ? (
              <CheckCircle2
                size={15}
                color={palette.success.text}
                strokeWidth={2.2}
              />
            ) : (
              <AlertTriangle
                size={15}
                color={palette.warning.text}
                strokeWidth={2.2}
              />
            )}
            <Text variant="label-lg" tone="primary" numberOfLines={1}>
              {line.productName || "Unreadable product"}
            </Text>
          </HStack>
          <Text variant="caption" tone="tertiary">
            {line.quantity ?? "—"} {line.pack || ""}
          </Text>
        </HStack>

        <HStack gap={6} wrap>
          <FieldChip
            label="Batch"
            value={line.batchNo}
            low={line.fields.batchNo.confidence === "low"}
            alt={line.fields.batchNo.alternative}
          />
          <FieldChip
            label="Exp"
            value={prettyExpiry(line.expiry)}
            low={line.fields.expiry.confidence === "low"}
            alt={line.fields.expiry.alternative}
          />
          {line.mrp != null && (
            <FieldChip
              label="MRP"
              value={`₹${line.mrp}`}
              low={line.fields.mrp.confidence === "low"}
              alt={null}
            />
          )}
        </HStack>

        {line.match ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            → {line.match.name} · {line.match.sku}
            {line.unitResolution?.resolved && line.unitResolution.factor
              ? ` · ${line.quantity ?? "?"} × ${line.unitResolution.unit} (${line.unitResolution.factor} ${line.match.baseUnit} each)`
              : ""}
          </Text>
        ) : (
          <Text variant="caption" tone="warning">
            Not matched to a product — you&apos;ll pick it on the next screen
          </Text>
        )}

        {/* The bill counts packs; if we couldn't prove which pack, say so. */}
        {line.match && !line.unitResolution?.resolved && (
          <Text variant="caption" tone="warning">
            {line.unitResolution?.reason || "Unit unclear — choose it next"}
          </Text>
        )}

        {/* Resolved, but the bill sells multi-packs — worth a glance. */}
        {line.unitResolution?.note && (
          <Text variant="caption" tone="tertiary">
            {line.unitResolution.note}
          </Text>
        )}

        {line.freeQty > 0 && (
          <Text variant="caption" tone="warning">
            +{line.freeQty} free on this bill — add them if you&apos;re stocking
            them
          </Text>
        )}
      </VStack>
    </Card>
  );
}

function FieldChip({
  label,
  value,
  low,
  alt,
}: {
  label: string;
  value: string | number | null;
  low: boolean;
  alt: string | number | null;
}) {
  return (
    <View style={[chip, low ? chipLow : chipOk]}>
      <Text
        variant="label-sm"
        style={{ color: low ? palette.warning.text : palette.success.text }}
      >
        {label}: {value ?? "—"}
        {low && alt ? `  (or ${alt}?)` : ""}
      </Text>
    </View>
  );
}

const turnBtn = {
  width: 42,
  height: 42,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: palette.border.default,
  backgroundColor: palette.surface.primary,
  alignItems: "center",
  justifyContent: "center",
} as const;
const zoomHint = {
  position: "absolute",
  right: 10,
  bottom: 10,
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  paddingHorizontal: 9,
  paddingVertical: 5,
  borderRadius: radius.full,
  backgroundColor: "rgba(15,23,42,0.65)",
} as const;
const zoomBackdrop = {
  flex: 1,
  backgroundColor: "rgba(2,6,23,0.94)",
  paddingTop: 54,
  paddingHorizontal: 12,
  paddingBottom: 8,
} as const;
const zoomClose = {
  position: "absolute",
  top: 14,
  right: 14,
  zIndex: 2,
  width: 40,
  height: 40,
  borderRadius: radius.full,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.14)",
} as const;
const chip = {
  paddingHorizontal: 9,
  paddingVertical: 4,
  borderRadius: radius.full,
  borderWidth: 1,
} as const;
const chipOk = {
  backgroundColor: palette.success.bg,
  borderColor: palette.success.border,
} as const;
const chipLow = {
  backgroundColor: palette.warning.bg,
  borderColor: palette.warning.border,
} as const;
const errBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
  marginBottom: 16,
} as const;
