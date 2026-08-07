import React from "react";
import { View } from "react-native";
import { Select } from "./Select";
import { TextField } from "./TextField";

/**
 * A reason, picked from a list, with room for the case nobody predicted.
 *
 * Free text produced "damaged", "Damaged", "dmg" and "" for the same event, so
 * nothing could be counted — and a reason is exactly the sort of thing an owner
 * wants to total at month end. Fixed options plus "Other…" keeps it countable
 * without blocking anything.
 *
 * Every place that records why stock moved backwards uses this, so the same
 * four words mean the same thing on a sales return, a purchase return and a
 * write-off. Two of those were still free-text boxes.
 */

/** The reasons a pharmacy actually records against stock coming back. */
export const RETURN_REASONS = [
  "Damaged",
  "Wrong item",
  "Sales return",
  "Expired",
];

/** Why stock is written off rather than sent back to anyone. */
export const WRITE_OFF_REASONS = [
  "Damaged",
  "Broken seal",
  "Expired",
  "Spillage",
  "Storage damage",
];

const OTHER = "__other__";

interface Props {
  label?: string;
  placeholder?: string;
  /** The reason list to offer. */
  options?: string[];
  /** Which option is picked ("" = none, or the OTHER sentinel). */
  value: string;
  onChange: (v: string) => void;
  /** Free text captured when "Other…" is picked. */
  custom: string;
  onCustomChange: (v: string) => void;
}

/** What actually gets saved: the picked option, or the typed one. */
export function reasonValue(value: string, custom: string): string {
  return value === OTHER ? custom.trim() : value;
}

export function ReasonSelect({
  label = "Reason",
  placeholder = "Pick a reason",
  options = RETURN_REASONS,
  value,
  onChange,
  custom,
  onCustomChange,
}: Props) {
  return (
    <View>
      <Select
        label={label}
        value={value}
        placeholder={placeholder}
        options={[
          ...options.map((r) => ({ value: r, label: r })),
          { value: OTHER, label: "Other…" },
        ]}
        onChange={(v) => onChange(v ?? "")}
      />
      {value === OTHER ? (
        <View style={{ marginTop: 10 }}>
          <TextField
            label="Describe the reason"
            value={custom}
            onChangeText={onCustomChange}
            placeholder="e.g. Wrong strength supplied"
            autoFocus
          />
        </View>
      ) : null}
    </View>
  );
}

export { OTHER as REASON_OTHER };
