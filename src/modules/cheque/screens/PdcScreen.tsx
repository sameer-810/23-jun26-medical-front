import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  View,
  Platform,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  CalendarClock,
  Plus,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Ban,
  Trash2,
  Camera,
  ScanText,
  ImageIcon,
} from "lucide-react-native";
import {
  useCheques,
  useUpcomingPdc,
  useCreateCheque,
  useSetChequeStatus,
  useRemoveCheque,
  useInvalidateCheques,
} from "@modules/cheque/hooks/useCheques";
import {
  Cheque,
  ChequeStatus,
  ChequeRead,
  hasChequeImage,
} from "@modules/cheque/types";
import { chequeApi } from "@modules/cheque/api/chequeApi";
import { useImageCapture, CapturedImage } from "@shared/useImageCapture";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { fmtMoneyExact, fmtDate } from "@shared/format";
import { palette, radius, accents } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatRow,
  StatusChip,
  Select,
  TextField,
  DateField,
  ChipsRow,
  EmptyState,
  ListRow,
  ListGroup,
  ConfirmDialog,
} from "@shared/ui";

// To the paisa: this register is read against the cheque in hand, and a
// rounded ₹65 does not match an instrument written for ₹64.50.
const money = fmtMoneyExact;

/** "bounced" -> "Bounced", so a row reads like the filter chip above it. */
const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const STATUS_TONE: Record<
  ChequeStatus,
  "warning" | "success" | "danger" | "neutral"
> = {
  pending: "warning",
  cleared: "success",
  bounced: "danger",
  cancelled: "neutral",
};

// Statuses that still have somewhere to go. A bounced cheque is included
// because re-presenting one is routine — it clears on the second run and the
// register has to be able to say so; the API allows bounced -> cleared.
const OPEN_STATUSES: ChequeStatus[] = ["pending", "bounced"];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "cleared", label: "Cleared" },
  { key: "bounced", label: "Bounced" },
  { key: "cancelled", label: "Cancelled" },
];

const emptyForm = {
  direction: "issued" as "issued" | "received",
  partyName: "",
  chequeNo: "",
  bankName: "",
  amount: "",
  chequeDate: "",
  note: "",
};

export default function PdcScreen() {
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Cleared is terminal — the row loses its actions and its Delete. Ask first,
  // the way deleting and receiving already do.
  const [clearTarget, setClearTarget] = useState<Cheque | null>(null);
  const [viewPhoto, setViewPhoto] = useState<Cheque | null>(null);
  const invalidateCheques = useInvalidateCheques();

  // Camera capture: the photo is held until the cheque is saved, then attached
  // to it. Reading and storing are separate jobs — one fills the form, the
  // other is the evidence if the cheque ever bounces.
  const { capture, inputRef, onWebFile } = useImageCapture();
  const [photo, setPhoto] = useState<CapturedImage | null>(null);
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<ChequeRead | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const scanCheque = async () => {
    const img = await capture();
    if (!img) return;
    setPhoto(img);
    setReadError(null);
    setReading(true);
    try {
      const r = await chequeApi.read(img);
      setReadResult(r);
      setShowForm(true);
      // Only the machine-printed fields are written straight in. The amount and
      // date are shown as a suggestion — nothing we hold could contradict a
      // misread amount, so a human has to agree to it.
      setForm((f) => ({
        ...f,
        chequeNo: r.autofill.chequeNo || f.chequeNo,
        bankName: r.autofill.bankName || f.bankName,
        partyName: r.confirm.payeeName || f.partyName,
      }));
    } catch (e) {
      setReadError(apiErrorMessage(e));
    } finally {
      setReading(false);
    }
  };

  /** Copy a read-but-unconfirmed value into the form, on purpose. */
  const acceptAmount = () =>
    readResult?.confirm.amount != null &&
    set("amount", String(readResult.confirm.amount));
  const acceptDate = () =>
    readResult?.confirm.chequeDate &&
    set("chequeDate", readResult.confirm.chequeDate);

  const canManage = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.SUPPLIERS_MANAGE,
  );

  const { data: summary } = useUpcomingPdc();
  const { data: list } = useCheques(
    filter === "all" ? undefined : { status: filter },
  );
  const createMut = useCreateCheque();
  const statusMut = useSetChequeStatus();
  const removeMut = useRemoveCheque();

  const cheques = list?.data ?? [];

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const amount = Number(form.amount);
    if (!(amount > 0) || !form.chequeDate) return;
    createMut.mutate(
      {
        direction: form.direction,
        partyType: form.direction === "issued" ? "supplier" : "customer",
        partyName: form.partyName.trim() || undefined,
        chequeNo: form.chequeNo.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        amount,
        chequeDate: form.chequeDate.trim(),
        note: form.note.trim() || undefined,
      },
      {
        onSuccess: async (created) => {
          // Attach the photo AFTER the cheque exists — it hangs off the record.
          // A failed upload must not lose the cheque itself, so it's best-effort
          // and reported rather than thrown.
          if (photo && created?._id) {
            try {
              await chequeApi.attachImage(created._id, photo);
              // The create mutation already invalidated; the photo landed after.
              invalidateCheques();
            } catch (e) {
              setReadError(
                `Cheque saved, but the photo didn't attach: ${apiErrorMessage(e)}`,
              );
            }
          }
          setForm(emptyForm);
          setPhoto(null);
          setReadResult(null);
          setShowForm(false);
        },
      },
    );
  };

  return (
    <Screen
      overline="Finance"
      title="Cheques & PDC"
      subtitle="Post-dated cheques you owe and are owed"
    >
      {/* Two figures, one panel. Receivable used to be a filled green card next
          to the payable one, which read as "good news" styling on what is just
          the other half of the same pair. Only payable keeps a colour, and only
          while there is actually money going out. */}
      <StatRow
        style={{ marginBottom: 16 }}
        stats={[
          {
            label: "Payable (pending)",
            value: money(summary?.payable.total ?? 0),
            hint: `${summary?.payable.count ?? 0} cheque${(summary?.payable.count ?? 0) === 1 ? "" : "s"}`,
            accent: (summary?.payable.total ?? 0) > 0 ? accents.red : undefined,
          },
          {
            label: "Receivable (pending)",
            value: money(summary?.receivable.total ?? 0),
            hint: `${summary?.receivable.count ?? 0} cheque${(summary?.receivable.count ?? 0) === 1 ? "" : "s"}`,
          },
        ]}
      />

      {/* Two half-width bars stretched across a 1,200px page is a phone layout
          that followed us onto the desktop. These are toolbar actions: they take
          the width of their labels and sit at the start of the row. */}
      {canManage ? (
        <HStack gap={8} style={{ marginBottom: 14 }}>
          <View>
            <Button
              label={showForm ? "Cancel" : "Add cheque"}
              variant={showForm ? "secondary" : "primary"}
              size="sm"
              fullWidth={false}
              icon={
                showForm ? (
                  <X size={16} color={palette.text.secondary} strokeWidth={2} />
                ) : (
                  <Plus size={16} color="#FFFFFF" strokeWidth={2} />
                )
              }
              onPress={() => setShowForm((s) => !s)}
            />
          </View>
          <View>
            <Button
              label={reading ? "Reading…" : "Scan cheque"}
              variant="secondary"
              size="sm"
              fullWidth={false}
              loading={reading}
              icon={
                <Camera
                  size={16}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              }
              onPress={() => void scanCheque()}
            />
          </View>
          {/* Web capture target — a phone browser opens the camera directly. */}
          {Platform.OS === "web" ? (
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={onWebFile}
            />
          ) : null}
        </HStack>
      ) : null}

      {readError ? (
        <View style={[errorBox, { marginBottom: 16 }]}>
          <Text variant="body-sm" tone="danger">
            {readError}
          </Text>
        </View>
      ) : null}

      {/* What the camera read, and what still needs a human. The printed fields
          are already in the form; these two are not, on purpose. */}
      {readResult ? (
        <Card style={{ marginBottom: 16 }}>
          <VStack gap={12}>
            <HStack gap={8} align="center">
              <ScanText size={18} color={palette.teal[700]} strokeWidth={2} />
              <Text variant="label-lg" tone="primary">
                Read from the cheque
              </Text>
              {photo ? (
                <StatusChip label="Photo will be attached" tone="info" />
              ) : null}
            </HStack>

            {readResult.warnings.map((w) => (
              <Text key={w} variant="caption" tone="warning">
                {w}
              </Text>
            ))}

            <HStack gap={10} wrap>
              {readResult.confirm.amount != null ? (
                <Button
                  label={`Use amount ₹${readResult.confirm.amount}`}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={acceptAmount}
                />
              ) : null}
              {readResult.confirm.chequeDate ? (
                <Button
                  label={`Use date ${readResult.confirm.chequeDate}`}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={acceptDate}
                />
              ) : null}
            </HStack>

            {readResult.confirm.amountInWords ? (
              <Text variant="caption" tone="tertiary">
                Words on the cheque: “{readResult.confirm.amountInWords}” —
                check this matches the figure you enter.
              </Text>
            ) : null}
          </VStack>
        </Card>
      ) : null}

      {showForm ? (
        <Card style={{ marginBottom: 16 }}>
          <VStack gap={14}>
            {createMut.isError ? (
              <View style={errorBox}>
                <Text variant="body-sm" tone="danger">
                  {apiErrorMessage(createMut.error)}
                </Text>
              </View>
            ) : null}
            <Select
              label="Type"
              value={form.direction}
              options={[
                { value: "issued", label: "Issued — we pay a supplier" },
                { value: "received", label: "Received — from a customer" },
              ]}
              onChange={(v) => set("direction", v || "issued")}
            />
            <TextField
              label={
                form.direction === "issued" ? "Supplier name" : "Customer name"
              }
              value={form.partyName}
              onChangeText={(v) => set("partyName", v)}
              placeholder="Party on the cheque"
            />
            <HStack gap={12}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Cheque no"
                  value={form.chequeNo}
                  onChangeText={(v) => set("chequeNo", v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Bank"
                  value={form.bankName}
                  onChangeText={(v) => set("bankName", v)}
                />
              </View>
            </HStack>
            <HStack gap={12}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Amount (₹)"
                  value={form.amount}
                  onChangeText={(v) => set("amount", v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateField
                  label="Cheque date"
                  value={form.chequeDate}
                  onChange={(v) => set("chequeDate", v)}
                />
              </View>
            </HStack>
            <TextField
              label="Note (optional)"
              value={form.note}
              onChangeText={(v) => set("note", v)}
            />
            <Button
              label="Save cheque"
              loading={createMut.isPending}
              onPress={submit}
            />
          </VStack>
        </Card>
      ) : null}

      <View style={{ marginBottom: 12 }}>
        <ChipsRow chips={FILTERS} active={filter} onChange={setFilter} />
      </View>

      {cheques.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No cheques"
          message="Post-dated cheques you record appear here, ordered by date."
        />
      ) : (
        /* One surface, hairlines between cheques. Each row used to be its own
           floating card carrying a 32px tinted square around a direction arrow;
           the arrow alone says issued-vs-received, and the tint was saying it a
           second time in a colour that clashed with the status chip beside it.
           A cheque's actions stay in a strip under its own row rather than in
           `right` — four buttons will not fit beside a party name on a phone. */
        <ListGroup>
          {cheques.map((c: Cheque) => {
            const issued = c.direction === "issued";
            return (
              <View key={c._id}>
                <ListRow
                  icon={issued ? ArrowUpRight : ArrowDownLeft}
                  title={c.partyName || (issued ? "Supplier" : "Customer")}
                  subtitle={[
                    fmtDate(c.chequeDate),
                    c.chequeNo ? `#${c.chequeNo}` : null,
                    c.bankName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  value={money(c.amount)}
                  right={
                    <HStack gap={8} align="center">
                      {/* Indicator and opener in one: the only cheques with
                          evidence are the ones showing this. */}
                      {hasChequeImage(c) ? (
                        <Pressable
                          onPress={() => setViewPhoto(c)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`View photo of cheque ${c.chequeNo || c.partyName}`}
                          style={styles.photoBtn}
                        >
                          <ImageIcon
                            size={14}
                            color={palette.teal[700]}
                            strokeWidth={2}
                          />
                          <Text variant="caption" style={styles.photoLabel}>
                            Photo
                          </Text>
                        </Pressable>
                      ) : null}
                      <StatusChip
                        label={titleCase(c.status)}
                        tone={STATUS_TONE[c.status]}
                      />
                    </HStack>
                  }
                />

                {canManage && OPEN_STATUSES.includes(c.status) ? (
                  <HStack gap={8} wrap style={styles.actions}>
                    <Button
                      label="Cleared"
                      variant="secondary"
                      size="xs"
                      fullWidth={false}
                      icon={
                        <Check
                          size={14}
                          color={palette.success.text}
                          strokeWidth={2.2}
                        />
                      }
                      loading={statusMut.isPending}
                      onPress={() => setClearTarget(c)}
                    />
                    {c.status === "pending" ? (
                      <Button
                        label="Bounced"
                        variant="secondary"
                        size="xs"
                        fullWidth={false}
                        icon={
                          <Ban
                            size={14}
                            color={palette.danger.text}
                            strokeWidth={2.2}
                          />
                        }
                        onPress={() =>
                          statusMut.mutate({ id: c._id, status: "bounced" })
                        }
                      />
                    ) : null}
                    <Button
                      label="Cancel"
                      variant="ghost"
                      size="xs"
                      fullWidth={false}
                      onPress={() =>
                        statusMut.mutate({ id: c._id, status: "cancelled" })
                      }
                    />
                  </HStack>
                ) : null}

                {canManage && c.status !== "cleared" ? (
                  <HStack justify="flex-end" style={styles.actions}>
                    <Button
                      label="Delete"
                      variant="ghost"
                      size="xs"
                      fullWidth={false}
                      icon={
                        <Trash2
                          size={14}
                          color={palette.text.tertiary}
                          strokeWidth={2}
                        />
                      }
                      onPress={() => setDeleteId(c._id)}
                    />
                  </HStack>
                ) : null}
              </View>
            );
          })}
        </ListGroup>
      )}

      <ConfirmDialog
        visible={deleteId !== null}
        title="Delete cheque?"
        message="This removes the cheque from the register."
        confirmLabel="Delete"
        destructive
        loading={removeMut.isPending}
        onConfirm={() => {
          if (deleteId)
            removeMut.mutate(deleteId, {
              onSuccess: () => setDeleteId(null),
            });
        }}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        visible={clearTarget !== null}
        title="Mark cheque cleared?"
        message={
          clearTarget
            ? `${money(clearTarget.amount)} — ${clearTarget.partyName}, cheque ${clearTarget.chequeNo}. A cleared cheque cannot be changed back.`
            : ""
        }
        confirmLabel="Mark cleared"
        loading={statusMut.isPending}
        onConfirm={() => {
          if (clearTarget)
            statusMut.mutate(
              { id: clearTarget._id, status: "cleared" },
              { onSuccess: () => setClearTarget(null) },
            );
        }}
        onCancel={() => setClearTarget(null)}
      />

      <ChequePhotoViewer
        cheque={viewPhoto}
        onClose={() => setViewPhoto(null)}
      />
    </Screen>
  );
}

/**
 * The attached photo, full width.
 *
 * Fetched on open rather than with the register: the bytes are excluded from
 * the list response, and pulling one photo per row would be the whole point of
 * that exclusion undone.
 */
function ChequePhotoViewer({
  cheque,
  onClose,
}: {
  cheque: Cheque | null;
  onClose: () => void;
}) {
  // Cached per cheque: reopening the same one should not refetch the bytes.
  const {
    data: uri,
    isError,
    error,
  } = useQuery({
    queryKey: ["cheque-image", cheque?._id],
    queryFn: () => chequeApi.image(cheque!._id),
    enabled: Boolean(cheque),
    staleTime: 5 * 60_000,
  });

  return (
    <Modal
      visible={cheque !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <HStack align="center" justify="space-between">
            <VStack gap={1} flex={1}>
              <Text variant="label-lg" tone="primary" numberOfLines={1}>
                {cheque?.partyName || "Cheque"}
              </Text>
              <Text variant="caption" tone="tertiary">
                {[
                  cheque?.chequeNo ? `#${cheque.chequeNo}` : null,
                  cheque?.bankName,
                  cheque ? money(cheque.amount) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </VStack>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          <View style={styles.photoWell}>
            {isError ? (
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(error)}
              </Text>
            ) : uri ? (
              <Image
                source={{ uri }}
                style={{ width: "100%", height: 260 }}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator color={palette.teal[600]} />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = {
  /** Action strip under a cheque row. Aligns to ListRow's 14px gutter. */
  actions: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.teal[50],
  },
  photoLabel: { color: palette.teal[700] },
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
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.surface.primary,
  },
  photoWell: {
    minHeight: 260,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.default,
    backgroundColor: palette.surface.secondary,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
} as const;

const errorBox = {
  padding: 12,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
} as const;
