import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ChevronDown, Check, Plus, X, Search } from "lucide-react-native";
import { palette, radius, outline, shadows } from "../designSystem";
import { Text } from "./Text";
import { TextField } from "./TextField";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
  /** When provided, shows an "Add new" field that creates an option inline. */
  onCreate?: (
    label: string,
  ) => Promise<{ value: string; label: string } | void>;
  allowClear?: boolean;
  /** Force the search box on/off. Defaults to on once the list gets long. */
  searchable?: boolean;
  /**
   * Server-side search. When given, typing calls this (debounced) instead of
   * filtering locally — required for catalogues too big to ship to the client.
   */
  onSearch?: (query: string) => void;
  /** Show a spinner while `onSearch` results are loading. */
  loading?: boolean;
  /** Label shown for the currently-selected value if it isn't in `options`. */
  selectedLabel?: string;
  /**
   * Offers to create the thing being searched for, handing back what was typed.
   *
   * Unlike `onCreate` — which makes something from a name alone — this just
   * closes the list and lets the caller ask for whatever else it needs. Use it
   * when a name isn't enough to create a usable record.
   */
  onRequestCreate?: (query: string) => void;
  /** Noun for the create row, e.g. "product" -> `Add "X" as a new product`. */
  createNoun?: string;
  /** Inline validation message — red border + caption, same as TextField. */
  error?: string;
  /** Helper text shown when there's no error. */
  hint?: string;
}

// Never render more than this at once: a 100k-option list would lock the UI.
const RENDER_CAP = 100;
const SEARCH_DEBOUNCE_MS = 300;

/** Select — a labeled field that opens a searchable modal option list. */
export function Select({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  onCreate,
  allowClear,
  searchable,
  onSearch,
  loading,
  selectedLabel,
  onRequestCreate,
  createNoun = "item",
  error,
  hint,
}: Props) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = options.find((o) => o.value === value);
  // Fall back to a caller-supplied label so a selected item still shows even
  // when it isn't in the current (searched/paged) option window.
  const shownLabel = selected?.label || (value ? selectedLabel : undefined);

  // Search once the list is long enough to be annoying, or when asked.
  const showSearch = searchable ?? (Boolean(onSearch) || options.length > 8);

  // Debounce server-side search so we don't fire a request per keystroke.
  useEffect(() => {
    if (!onSearch) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => onSearch(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, onSearch]);

  // Local filtering only when the caller isn't searching server-side.
  const filtered = useMemo(() => {
    if (onSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, onSearch]);

  const visible = filtered.slice(0, RENDER_CAP);
  const hidden = filtered.length - visible.length;

  const close = () => {
    setOpen(false);
    setQuery("");
    onSearch?.("");
  };

  const create = async () => {
    if (!onCreate || !newLabel.trim()) return;
    setCreating(true);
    try {
      const made = await onCreate(newLabel.trim());
      if (made) onChange(made.value);
      setNewLabel("");
      close();
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      {label && (
        <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : null]}
      >
        <Text
          variant="body"
          tone={shownLabel ? "primary" : "tertiary"}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {shownLabel || placeholder}
        </Text>
        <ChevronDown
          size={18}
          color={palette.text.tertiary}
          strokeWidth={1.8}
        />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text variant="h4" tone="primary">
                {label || "Select"}
              </Text>
              <Pressable onPress={close} hitSlop={8}>
                <X size={20} color={palette.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            {showSearch && (
              <View style={styles.searchRow}>
                <Search
                  size={16}
                  color={palette.text.tertiary}
                  strokeWidth={2}
                />
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="Type to search…"
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="none"
                  />
                </View>
                {loading && <ActivityIndicator color={palette.teal[600]} />}
              </View>
            )}

            <ScrollView
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
            >
              {allowClear && !query && (
                <OptionRow
                  label="None"
                  selected={!value}
                  onPress={() => {
                    onChange(null);
                    close();
                  }}
                />
              )}
              {visible.map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  selected={o.value === value}
                  onPress={() => {
                    onChange(o.value);
                    close();
                  }}
                />
              ))}
              {!visible.length && !loading && (
                <Text variant="body-sm" tone="tertiary" style={{ padding: 16 }}>
                  {query ? `No matches for "${query}"` : "No options yet."}
                </Text>
              )}
              {hidden > 0 && (
                <Text variant="caption" tone="tertiary" style={{ padding: 12 }}>
                  +{hidden} more — keep typing to narrow it down.
                </Text>
              )}
            </ScrollView>

            {/* PINNED below the list, never inside it. A catalogue this size
                renders up to a hundred rows, and an escape hatch you can only
                reach by scrolling past all of them is not an escape hatch. */}
            {onRequestCreate && (
              <Pressable
                onPress={() => {
                  const q = query.trim();
                  close();
                  onRequestCreate(q);
                }}
                accessibilityLabel={`Add a new ${createNoun}`}
                style={({ pressed }) => [
                  styles.requestCreate,
                  pressed && { backgroundColor: palette.teal[100] },
                ]}
              >
                <Plus size={16} color={palette.teal[700]} strokeWidth={2.4} />
                <Text
                  variant="label"
                  style={{ color: palette.teal[700], flex: 1 }}
                  numberOfLines={1}
                >
                  {query.trim()
                    ? `Add "${query.trim()}" as a new ${createNoun}`
                    : `Add a new ${createNoun}`}
                </Text>
              </Pressable>
            )}

            {onCreate && (
              <View style={styles.createRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="Add new…"
                    value={newLabel}
                    onChangeText={setNewLabel}
                    onSubmitEditing={create}
                  />
                </View>
                <Pressable
                  onPress={create}
                  disabled={creating || !newLabel.trim()}
                  style={styles.addBtn}
                >
                  <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        pressed && { backgroundColor: palette.ink[50] },
      ]}
    >
      <Text
        variant="body"
        tone={selected ? "accent" : "primary"}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected && (
        <Check size={18} color={palette.teal[600]} strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: outline.width,
    borderColor: outline.color,
    backgroundColor: palette.surface.primary,
  },
  fieldError: {
    borderColor: palette.danger.text,
  },
  requestCreate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.teal[50],
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 16,
    ...shadows.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: palette.teal[600],
    alignItems: "center",
    justifyContent: "center",
  },
});
