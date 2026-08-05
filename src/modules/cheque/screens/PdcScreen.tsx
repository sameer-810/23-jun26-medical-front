import React, { useState } from "react";
import { View, Platform } from "react-native";
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
} from "lucide-react-native";
import {
  useCheques,
  useUpcomingPdc,
  useCreateCheque,
  useSetChequeStatus,
  useRemoveCheque,
} from "@modules/cheque/hooks/useCheques";
import { Cheque, ChequeStatus, ChequeRead } from "@modules/cheque/types";
import { chequeApi } from "@modules/cheque/api/chequeApi";
import { useImageCapture, CapturedImage } from "@shared/useImageCapture";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatTile,
  StatusChip,
  Select,
  TextField,
  DateField,
  ChipsRow,
  EmptyState,
  ConfirmDialog,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const STATUS_TONE: Record<
  ChequeStatus,
  "warning" | "success" | "danger" | "neutral"
> = {
  pending: "warning",
  cleared: "success",
  bounced: "danger",
  cancelled: "neutral",
};

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
      <HStack gap={12} style={{ marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Payable (pending)"
            value={money(summary?.payable.total ?? 0)}
            hint={`${summary?.payable.count ?? 0} cheque${(summary?.payable.count ?? 0) === 1 ? "" : "s"}`}
            accent={
              (summary?.payable.total ?? 0) > 0
                ? { color: palette.danger.text, tint: palette.danger.bg }
                : undefined
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Receivable (pending)"
            value={money(summary?.receivable.total ?? 0)}
            hint={`${summary?.receivable.count ?? 0} cheque${(summary?.receivable.count ?? 0) === 1 ? "" : "s"}`}
            tone="teal"
          />
        </View>
      </HStack>

      {canManage ? (
        <HStack gap={10} style={{ marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={showForm ? "Cancel" : "Add cheque"}
              variant={showForm ? "secondary" : "primary"}
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
          <View style={{ flex: 1 }}>
            <Button
              label={reading ? "Reading…" : "Scan cheque"}
              variant="secondary"
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
        <VStack gap={12}>
          {cheques.map((c: Cheque) => {
            const issued = c.direction === "issued";
            return (
              <Card key={c._id} elevation="base">
                <HStack align="center" justify="space-between" gap={10}>
                  <HStack gap={10} align="center" flex={1}>
                    <View
                      style={[
                        styles.dirBadge,
                        {
                          backgroundColor: issued
                            ? palette.danger.bg
                            : palette.teal[50],
                        },
                      ]}
                    >
                      {issued ? (
                        <ArrowUpRight
                          size={16}
                          color={palette.danger.text}
                          strokeWidth={2.2}
                        />
                      ) : (
                        <ArrowDownLeft
                          size={16}
                          color={palette.teal[600]}
                          strokeWidth={2.2}
                        />
                      )}
                    </View>
                    <VStack gap={3} flex={1}>
                      <Text variant="label-lg" tone="primary">
                        {c.partyName || (issued ? "Supplier" : "Customer")}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {fmtDate(c.chequeDate)}
                        {c.chequeNo ? ` · #${c.chequeNo}` : ""}
                        {c.bankName ? ` · ${c.bankName}` : ""}
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack gap={4} align="flex-end">
                    <Text variant="label-lg" tone="primary">
                      {money(c.amount)}
                    </Text>
                    <StatusChip label={c.status} tone={STATUS_TONE[c.status]} />
                  </VStack>
                </HStack>

                {canManage && c.status === "pending" ? (
                  <HStack gap={8} style={{ marginTop: 12 }}>
                    <Button
                      label="Cleared"
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      icon={
                        <Check
                          size={14}
                          color={palette.success.text}
                          strokeWidth={2.2}
                        />
                      }
                      loading={statusMut.isPending}
                      onPress={() =>
                        statusMut.mutate({ id: c._id, status: "cleared" })
                      }
                    />
                    <Button
                      label="Bounced"
                      variant="secondary"
                      size="sm"
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
                    <Button
                      label="Cancel"
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      onPress={() =>
                        statusMut.mutate({ id: c._id, status: "cancelled" })
                      }
                    />
                  </HStack>
                ) : null}

                {canManage && c.status !== "cleared" ? (
                  <HStack justify="flex-end" style={{ marginTop: 8 }}>
                    <Button
                      label="Delete"
                      variant="ghost"
                      size="sm"
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
              </Card>
            );
          })}
        </VStack>
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
    </Screen>
  );
}

const styles = {
  dirBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
} as const;

const errorBox = {
  padding: 12,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
} as const;
