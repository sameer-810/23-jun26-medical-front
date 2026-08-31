/**
 * The prescription gate at the till (client Feature R2-2).
 *
 * Opens when the cart holds a Schedule H / H1 / X or Rx-flagged item and no
 * prescription is attached yet. Two ways through, in the order a busy
 * counter wants them: pick a prescription already on file for this customer
 * and still valid, or record the one in the pharmacist's hand — doctor,
 * date, patient, a photo — which is verified on the spot, because the
 * pharmacist looking at the paper IS the verification.
 */
import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { X, Camera, CheckCircle2 } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import {
  prescriptionApi,
  Prescription,
} from "@modules/sale/api/prescriptionApi";
import { useImageCapture, CapturedImage } from "@shared/useImageCapture";
import { apiErrorMessage } from "@api/apiClient";
import { fmtDate } from "@shared/format";
import { palette, radius, shadows } from "@shared/designSystem";
import {
  Text,
  VStack,
  HStack,
  Button,
  TextField,
  Banner,
  StatusChip,
} from "@shared/ui";

interface Props {
  visible: boolean;
  customerId: string | null;
  customerName?: string;
  /** Names of the items that need the prescription — shown so the reason is clear. */
  rxItems: string[];
  /** Pre-filled from the sale screen's doctor box, if typed. */
  doctorName?: string;
  onDone: (prescriptionId: string, doctorName: string) => void;
  onCancel: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function RxGateModal({
  visible,
  customerId,
  customerName,
  rxItems,
  doctorName: initialDoctor,
  onDone,
  onCancel,
}: Props) {
  const [doctor, setDoctor] = useState(initialDoctor || "");
  const [regNo, setRegNo] = useState("");
  const [date, setDate] = useState(today());
  const [patient, setPatient] = useState(customerName || "");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState<CapturedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { capture, busy: camBusy, inputRef, onWebFile } = useImageCapture();

  const existing = useQuery({
    queryKey: ["prescriptions", "valid", customerId],
    queryFn: () => prescriptionApi.validFor(customerId as string),
    enabled: visible && !!customerId,
  });

  const pickExisting = (p: Prescription) => onDone(p.id, p.doctorName);

  const recordNew = async () => {
    if (doctor.trim().length < 2) {
      setError("Enter the prescribing doctor's name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await prescriptionApi.create({
        customerId,
        patientName: patient.trim() || undefined,
        patientAge: age.trim() || undefined,
        doctorName: doctor.trim(),
        doctorRegNo: regNo.trim() || undefined,
        prescribedOn: date || undefined,
        verified: true,
      });
      if (photo) {
        // The record exists even if the upload fails — the sale must not
        // hang on a slow counter connection; the photo can be re-attached.
        await prescriptionApi.attachImage(created.id, photo).catch(() => {});
      }
      onDone(created.id, created.doctorName);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <HStack
            align="center"
            justify="space-between"
            style={{ marginBottom: 6 }}
          >
            <VStack gap={0} flex={1}>
              <Text variant="h3" tone="primary">
                Prescription required
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={2}>
                {rxItems.slice(0, 3).join(", ")}
                {rxItems.length > 3 ? ` +${rxItems.length - 3} more` : ""} —
                Schedule H/H1/X items need a doctor&apos;s prescription on
                record.
              </Text>
            </VStack>
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              accessibilityLabel="Cancel"
            >
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          <ScrollView style={{ maxHeight: 520 }}>
            {customerId && (existing.data?.length ?? 0) > 0 ? (
              <View style={{ marginTop: 8, marginBottom: 12 }}>
                <Text
                  variant="label"
                  tone="secondary"
                  style={{ marginBottom: 6 }}
                >
                  On file for {customerName || "this customer"} — still valid
                </Text>
                {existing.data!.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => pickExisting(p)}
                    style={styles.row}
                    accessibilityRole="button"
                  >
                    <VStack gap={2} flex={1}>
                      <Text variant="label" tone="primary">
                        Dr. {p.doctorName}
                        {p.doctorRegNo ? ` · ${p.doctorRegNo}` : ""}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {fmtDate(p.prescribedOn)} · valid till{" "}
                        {fmtDate(p.validUntil)}
                        {p.hasImage ? " · photo attached" : ""}
                      </Text>
                    </VStack>
                    <StatusChip
                      tone={p.status === "verified" ? "success" : "warning"}
                      label={p.status}
                    />
                  </Pressable>
                ))}
                <Text
                  variant="caption"
                  tone="tertiary"
                  style={{ marginTop: 6 }}
                >
                  Or record the new prescription below.
                </Text>
              </View>
            ) : null}

            <VStack gap={10} style={{ marginTop: 8 }}>
              <TextField
                label="Doctor"
                placeholder="Dr. name as printed on the prescription"
                value={doctor}
                onChangeText={setDoctor}
                autoCapitalize="words"
              />
              <HStack gap={10}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Reg. no. (optional)"
                    value={regNo}
                    onChangeText={setRegNo}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Prescribed on"
                    placeholder="YYYY-MM-DD"
                    value={date}
                    onChangeText={setDate}
                  />
                </View>
              </HStack>
              <HStack gap={10}>
                <View style={{ flex: 2 }}>
                  <TextField
                    label="Patient"
                    value={patient}
                    onChangeText={setPatient}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Age"
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                  />
                </View>
              </HStack>

              <HStack gap={10} align="center">
                <Button
                  label={photo ? "Retake photo" : "Photograph prescription"}
                  variant="secondary"
                  size="sm"
                  loading={camBusy}
                  icon={
                    <Camera
                      size={16}
                      color={palette.text.secondary}
                      strokeWidth={2}
                    />
                  }
                  onPress={async () => {
                    const img = await capture();
                    if (img) setPhoto(img);
                  }}
                />
                {photo ? (
                  <HStack gap={4} align="center">
                    <CheckCircle2
                      size={16}
                      color={palette.success.text}
                      strokeWidth={2}
                    />
                    <Text variant="caption" tone="success">
                      Photo ready
                    </Text>
                  </HStack>
                ) : (
                  <Text variant="caption" tone="tertiary">
                    Optional now; the register can be completed later.
                  </Text>
                )}
              </HStack>
              {Platform.OS === "web" ? (
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={onWebFile}
                />
              ) : null}

              {error ? <Banner tone="danger" message={error} /> : null}

              <Button
                label="Verify & continue sale"
                loading={busy}
                disabled={doctor.trim().length < 2}
                onPress={() => void recordNew()}
              />
              <Text variant="caption" tone="tertiary">
                By continuing you confirm the prescription is genuine, current
                and covers these items. It is recorded in the Schedule H
                register with this bill.
              </Text>
            </VStack>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
});
