/**
 * DateField — a date that is picked, not typed.
 *
 * Replaces the plain text inputs that asked staff to key "YYYY-MM-DD" on a
 * phone. Two problems with that, both reported from the counter: the on-screen
 * keyboard sat on top of the field being filled, so every date meant dismissing
 * the keyboard and reopening it; and ISO order is not how anyone in India reads
 * a date off a pack.
 *
 * So: the value is displayed DD-MM-YYYY, entry is a picker (no keyboard ever
 * opens), and the stored string stays ISO because that is what the API takes.
 *
 * `mode="month"` exists because expiry is a month, not a day — packs print
 * "EXP 08/2026", meaning the lot is good to the END of August. Picking a day
 * would silently expire stock early under FEFO, so a month value stores
 * "YYYY-MM" and the existing normaliser expands it to the last of the month.
 */
import React, { useState } from "react";
import { View, Pressable, Platform, StyleSheet } from "react-native";
import { Calendar } from "lucide-react-native";
import { palette, radius, outline } from "../designSystem";
import { Text } from "./Text";

// Native-only module: requiring it on web would pull in native bindings that
// do not exist there. The ternary keeps the call off the web path.
const DateTimePicker =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@react-native-community/datetimepicker").default;

export type DateMode = "date" | "month";

interface Props {
  label?: string;
  /** ISO: "YYYY-MM-DD" for date mode, "YYYY-MM" for month mode. "" when unset. */
  value: string;
  onChange: (value: string) => void;
  mode?: DateMode;
  placeholder?: string;
  error?: string;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Grid variant: 38px tall, no label, matches the goods-received row. */
  compact?: boolean;
  /** Grid variant colouring for an expired / expiring lot. */
  tone?: "default" | "error" | "warn";
  width?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-08-31" -> "31-08-2026"; "2026-08" -> "08/2026". Blank stays blank. */
export function formatDateDisplay(value: string, mode: DateMode = "date") {
  const t = String(value || "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return t; // unrecognised — show it rather than hide it
  const [, y, mo, d] = m;
  if (mode === "month") return `${mo}/${y}`;
  return d ? `${d}-${mo}-${y}` : `${mo}/${y}`;
}

function toDate(value: string): Date {
  const m = String(value || "")
    .trim()
    .match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1);
}

function fromDate(d: Date, mode: DateMode) {
  const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return mode === "month" ? ym : `${ym}-${pad(d.getDate())}`;
}

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  placeholder,
  error,
  hint,
  minimumDate,
  maximumDate,
  compact,
  tone = "default",
  width,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const display = formatDateDisplay(value, mode);
  const hint_ = placeholder || (mode === "month" ? "MM/YYYY" : "DD-MM-YYYY");

  const borderColor =
    error || tone === "error"
      ? palette.danger.text
      : tone === "warn"
        ? palette.warning.text
        : focused
          ? palette.teal[500]
          : compact
            ? palette.border.default
            : outline.color;
  const backgroundColor =
    tone === "error"
      ? palette.danger.bg
      : tone === "warn"
        ? palette.warning.bg
        : palette.surface.primary;

  const shell = [
    compact ? styles.cellWrap : styles.wrap,
    { borderColor, backgroundColor },
    !compact && focused ? { borderWidth: 1.5 } : null,
    width ? { width } : null,
  ];

  /**
   * Web gets the browser's own date control. It renders in the user's locale —
   * DD/MM/YYYY for an Indian install — and brings a real calendar, so the web
   * and mobile builds behave the same way rather than one typing and one
   * picking.
   */
  const field =
    Platform.OS === "web" ? (
      <View style={shell}>
        <input
          type={mode === "month" ? "month" : "date"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          min={minimumDate ? fromDate(minimumDate, mode) : undefined}
          max={maximumDate ? fromDate(maximumDate, mode) : undefined}
          style={{
            flex: 1,
            width: "100%",
            // Fill the shell. Left to its intrinsic height the control sat 18px
            // tall inside a 38px cell, so most of the box looked like a field
            // but did nothing when clicked.
            height: "100%",
            alignSelf: "stretch",
            border: "none",
            outline: "none",
            background: "transparent",
            font: "inherit",
            fontSize: compact ? 13 : 15,
            color: palette.text.primary,
            padding: 0,
          }}
        />
      </View>
    ) : (
      <Pressable
        onPress={() => setOpen(true)}
        style={shell}
        accessibilityRole="button"
        accessibilityLabel={
          label ? `${label}: ${display || "not set"}` : undefined
        }
      >
        <Text
          variant={compact ? "body-sm" : "body"}
          tone={display ? "primary" : "tertiary"}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {display || hint_}
        </Text>
        {!compact && (
          <Calendar size={18} color={palette.text.tertiary} strokeWidth={1.8} />
        )}
      </Pressable>
    );

  return (
    <View>
      {label && !compact ? (
        <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      {field}
      {open && DateTimePicker ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event: { type: string }, selected?: Date) => {
            // Android dismisses itself; iOS keeps the spinner up until a pick.
            if (Platform.OS !== "ios") setOpen(false);
            if (event.type === "dismissed" || !selected) return;
            if (Platform.OS === "ios") setOpen(false);
            onChange(fromDate(selected, mode));
          }}
        />
      ) : null}
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint && !compact ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  // Matches the goods-received grid's other cells so one column doesn't jump.
  cellWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
  },
});
