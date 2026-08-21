/**
 * Combobox — inline autocomplete search. Unlike Select (a modal picker), this
 * keeps focus and shows results in a dropdown right under the field, with full
 * keyboard control (↑/↓ to move, Enter to pick, Esc to close). Built for
 * fast, keyboard-first entry like counter billing.
 *
 * The parent owns the query (so it can debounce + fetch server-side) and the
 * result list; the Combobox owns focus, open state and the highlight cursor.
 */
import React, { useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { palette, radius, outline, shadows, layout } from "../designSystem";
import { useControlHeight } from "./useBreakpoint";
import { Text } from "./Text";

export interface ComboItem {
  value: string;
  label: string;
  sublabel?: string;
  right?: string;
}

interface Props {
  placeholder?: string;
  query: string;
  onQueryChange: (s: string) => void;
  items: ComboItem[];
  loading?: boolean;
  onSelect: (value: string, item: ComboItem) => void;
  /** Enter with no result to take — e.g. a scanned/typed barcode. */
  onSubmitRaw?: (text: string) => void;
  leading?: React.ReactNode;
  autoFocus?: boolean;
  nativeID?: string;
  emptyText?: string;
  /**
   * Keep the result list open and in normal layout flow, instead of floating it
   * below the field and hiding it on blur.
   *
   * For a field embedded in a page, a dropdown that closes when you look away is
   * right. Inside a modal that exists ONLY to pick something, it is wrong twice:
   * the list disappears the moment the user reaches for the mouse, and an
   * absolutely-positioned panel reserves no height, so the sheet is left showing
   * a large empty area that reads as a broken screen.
   */
  alwaysOpen?: boolean;
}

export function Combobox({
  placeholder,
  query,
  onQueryChange,
  items,
  loading,
  onSelect,
  onSubmitRaw,
  leading,
  autoFocus,
  nativeID,
  emptyText = "No matches",
  alwaysOpen = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [hi, setHi] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlHeight = useControlHeight();

  // `alwaysOpen` keeps the list mounted regardless of focus (modal pickers).
  const open = alwaysOpen || (focused && query.trim().length > 0);

  const pick = (i: number) => {
    const item = items[i];
    if (!item) return;
    onSelect(item.value, item);
    onQueryChange("");
    setHi(-1);
  };

  const onKeyPress = (e: {
    nativeEvent: { key: string };
    preventDefault?: () => void;
  }) => {
    const key = e.nativeEvent.key;
    if (key === "ArrowDown") {
      e.preventDefault?.();
      setHi((h) => Math.min(h + 1, items.length - 1));
    } else if (key === "ArrowUp") {
      e.preventDefault?.();
      setHi((h) => Math.max(h - 1, 0));
    } else if (key === "Enter") {
      if (hi >= 0 && items[hi]) pick(hi);
      // Type-and-Enter with nothing highlighted takes the top result. While
      // `loading` the list still belongs to an earlier query — a scanner types
      // faster than the debounce, so those Enters go to the raw handler.
      else if (!loading && query.trim() && items.length > 0) pick(0);
      else if (onSubmitRaw && query.trim()) {
        onSubmitRaw(query.trim());
        onQueryChange("");
      }
    } else if (key === "Escape") {
      onQueryChange("");
      setHi(-1);
    }
  };

  return (
    <View style={{ position: "relative", zIndex: 20 }}>
      <View
        style={[
          styles.field,
          {
            minHeight: controlHeight,
            borderColor: focused ? palette.teal[500] : outline.color,
          },
          focused && { borderWidth: 1.5 },
        ]}
      >
        {leading ? <View style={{ marginRight: 10 }}>{leading}</View> : null}
        <TextInput
          nativeID={nativeID}
          value={query}
          onChangeText={(t) => {
            onQueryChange(t);
            setHi(-1);
          }}
          onKeyPress={onKeyPress as never}
          placeholder={placeholder}
          placeholderTextColor={palette.text.tertiary}
          autoFocus={autoFocus}
          autoCorrect={false}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            // Delay so a press on a result registers before we close.
            blurTimer.current = setTimeout(() => setFocused(false), 120);
          }}
          // @ts-expect-error web-only outline reset
          style={[styles.input, { outlineStyle: "none" }]}
        />
        {loading ? (
          <ActivityIndicator
            color={palette.teal[600]}
            style={{ marginLeft: 8 }}
          />
        ) : null}
      </View>

      {open ? (
        <View style={[styles.panel, alwaysOpen && styles.panelInline]}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="body-sm" tone="tertiary">
                {loading ? "Searching…" : emptyText}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 288 }}
              keyboardShouldPersistTaps="always"
            >
              {items.map((it, i) => (
                <Pressable
                  key={it.value}
                  onPress={() => pick(i)}
                  onHoverIn={() => setHi(i)}
                  style={[styles.row, i === hi && styles.rowActive]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="body-sm" tone="primary" numberOfLines={1}>
                      {it.label}
                    </Text>
                    {it.sublabel ? (
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {it.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {it.right ? (
                    <Text
                      variant="label-sm"
                      tone="accent"
                      style={{ marginLeft: 10 }}
                    >
                      {it.right}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 11,
    backgroundColor: palette.surface.primary,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: palette.text.primary,
    paddingVertical: 8,
  },
  panel: {
    position: "absolute",
    top: layout.controlHeightPhone + 6,
    left: 0,
    right: 0,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.default,
    ...shadows.lg,
    zIndex: 50,
    overflow: "hidden",
  },
  /** In-flow variant: takes real height so nothing sits over a blank gap. */
  panelInline: {
    position: "relative",
    top: 0,
    marginTop: 8,
    shadowOpacity: 0,
    elevation: 0,
  },
  empty: { padding: 14, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: layout.rowHeight,
  },
  rowActive: { backgroundColor: palette.teal[50] },
});
