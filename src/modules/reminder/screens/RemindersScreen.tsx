import React, { useState } from "react";
import { View } from "react-native";
import {
  BellRing,
  BellOff,
  CalendarPlus,
  Check,
  RotateCcw,
  Trash2,
} from "lucide-react-native";
import {
  useReminders,
  useReminderSummary,
  useCreateReminder,
  useUpdateReminder,
  useRemoveReminder,
} from "@modules/reminder/hooks/useReminders";
import { Reminder, ReminderPriority } from "@modules/reminder/types";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
  DateField,
  ChipsRow,
  StatusChip,
  EmptyState,
} from "@shared/ui";

const PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
];
const FILTERS = [
  { key: "pending", label: "Open" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];
const PRIORITY_TONE = {
  low: "neutral",
  normal: "info",
  high: "warning",
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function formatDue(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RemindersScreen() {
  const [filter, setFilter] = useState("pending");
  const { data: list, isLoading } = useReminders({ status: filter });
  const { data: summary } = useReminderSummary();
  const createMut = useCreateReminder();
  const updateMut = useUpdateReminder();
  const removeMut = useRemoveReminder();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("09:00");
  const [priority, setPriority] = useState<ReminderPriority>("normal");

  const dateOk = DATE_RE.test(date.trim());
  const timeOk = TIME_RE.test(time.trim());
  const ready = title.trim().length > 0 && dateOk && timeOk;

  const submit = () => {
    if (!ready) return;
    const dueAt = new Date(`${date.trim()}T${time.trim()}:00`).toISOString();
    createMut.mutate(
      {
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueAt,
        priority,
      },
      {
        onSuccess: () => {
          setTitle("");
          setNotes("");
          setPriority("normal");
        },
      },
    );
  };

  const toggle = (r: Reminder) =>
    updateMut.mutate({
      id: r.id,
      patch: { status: r.status === "done" ? "pending" : "done" },
    });

  const items = list?.data || [];

  return (
    <Screen
      overline="Reminders"
      title="Your reminders"
      subtitle="Set a reminder for anything — reorders, payments, follow-ups"
    >
      {/* Summary */}
      {summary && (summary.overdue > 0 || summary.dueToday > 0) && (
        <HStack gap={8} style={{ marginBottom: 16 }} wrap>
          {summary.overdue > 0 && (
            <StatusChip label={`${summary.overdue} overdue`} tone="danger" />
          )}
          {summary.dueToday > 0 && (
            <StatusChip
              label={`${summary.dueToday} due today`}
              tone="warning"
            />
          )}
          <StatusChip label={`${summary.pending} open`} tone="info" />
        </HStack>
      )}

      {createMut.isError && (
        <View style={errBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(createMut.error)}
          </Text>
        </View>
      )}

      {/* New reminder */}
      <Card style={{ marginBottom: 20 }}>
        <VStack gap={14}>
          <TextField
            label="What do you want to be reminded about?"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Reorder Amoxicillin 500mg"
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details…"
          />
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              {/* A picker can't produce an invalid date, so the format error
                  that used to live here has nothing left to catch. */}
              <DateField label="Due date" value={date} onChange={setDate} />
            </View>
            <View style={{ width: 120 }}>
              <TextField
                label="Time"
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                error={time && !timeOk ? "HH:MM" : undefined}
              />
            </View>
          </HStack>
          <View>
            <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
              Priority
            </Text>
            <ChipsRow
              chips={PRIORITIES}
              active={priority}
              onChange={(k) => setPriority(k as ReminderPriority)}
            />
          </View>
          <Button
            label="Add reminder"
            size="lg"
            loading={createMut.isPending}
            disabled={!ready}
            onPress={submit}
            icon={<CalendarPlus size={18} color="#FFFFFF" strokeWidth={2} />}
          />
        </VStack>
      </Card>

      {/* List */}
      <HStack
        justify="space-between"
        align="center"
        style={{ marginBottom: 12 }}
      >
        <Text variant="h3" tone="primary">
          Reminders
        </Text>
        <ChipsRow chips={FILTERS} active={filter} onChange={setFilter} />
      </HStack>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No reminders"
          message="Add one above and it'll show up here."
        />
      ) : (
        <VStack gap={12}>
          {items.map((r) => {
            const done = r.status === "done";
            return (
              <Card key={r.id} elevation="base">
                <HStack align="flex-start" justify="space-between" gap={12}>
                  <VStack gap={5} flex={1}>
                    <Text
                      variant="label-lg"
                      tone={done ? "tertiary" : "primary"}
                      numberOfLines={2}
                      style={
                        done
                          ? { textDecorationLine: "line-through" }
                          : undefined
                      }
                    >
                      {r.title}
                    </Text>
                    {r.notes ? (
                      <Text variant="caption" tone="tertiary" numberOfLines={2}>
                        {r.notes}
                      </Text>
                    ) : null}
                    <HStack gap={6} align="center" wrap>
                      <StatusChip
                        label={formatDue(r.dueAt)}
                        tone={
                          r.isOverdue ? "danger" : done ? "neutral" : "info"
                        }
                      />
                      {r.isOverdue && !done && (
                        <StatusChip label="Overdue" tone="danger" />
                      )}
                      <StatusChip
                        label={r.priority}
                        tone={PRIORITY_TONE[r.priority]}
                      />
                    </HStack>
                  </VStack>
                  <VStack gap={8} align="flex-end">
                    <Button
                      label={done ? "Reopen" : "Done"}
                      variant={done ? "secondary" : "primary"}
                      size="sm"
                      fullWidth={false}
                      onPress={() => toggle(r)}
                      icon={
                        done ? (
                          <RotateCcw
                            size={15}
                            color={palette.text.primary}
                            strokeWidth={2}
                          />
                        ) : (
                          <Check size={15} color="#FFFFFF" strokeWidth={2.4} />
                        )
                      }
                    />
                    <Button
                      label="Delete"
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      onPress={() => removeMut.mutate(r.id)}
                      icon={
                        <Trash2
                          size={15}
                          color={palette.danger.text}
                          strokeWidth={2}
                        />
                      }
                    />
                  </VStack>
                </HStack>
              </Card>
            );
          })}
        </VStack>
      )}
    </Screen>
  );
}

const errBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
  marginBottom: 16,
} as const;
