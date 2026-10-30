/**
 * Combobox — inline autocomplete search. Unlike Select (a modal picker), this
 * keeps focus and shows results in a dropdown right under the field, with full
 * keyboard control (↑/↓ to move, Enter to pick, Esc to close). Built for
 * fast, keyboard-first entry like counter billing.
 *
 * The parent owns the query (so it can debounce + fetch server-side) and the
 * result list; the Combobox owns focus, open state and the highlight cursor.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { palette, radius, outline, shadows, layout } from "../designSystem";
import { useControlHeight } from "./useBreakpoint";
import { Text } from "./Text";
import { BurstTracker } from "../scanBurst";
import { enterAction, topIndex } from "./comboEnter";

export interface ComboItem {
  value: string;
  label: string;
  sublabel?: string;
  right?: string;
  /** SKU, barcode: typed exactly, these outrank the search's own order. */
  codes?: (string | null | undefined)[];
}

interface Props {
  placeholder?: string;
  query: string;
  onQueryChange: (s: string) => void;
  items: ComboItem[];
  loading?: boolean;
  onSelect: (value: string, item: ComboItem) => void;
  /**
   * Enter with no result to take — e.g. a scanned/typed barcode. Resolves true
   * once the text was dealt with; false means nothing matched and it stays in
   * the box. Stay quiet about a miss: the search may still answer it.
   */
  onSubmitRaw?: (text: string) => Promise<boolean> | boolean;
  /** Neither the search nor onSubmitRaw could use what was typed. */
  onRawMiss?: (text: string) => void;
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
  onRawMiss,
  leading,
  autoFocus,
  nativeID,
  emptyText = "No matches",
  alwaysOpen = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [hi, setHi] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const controlHeight = useControlHeight();
  const burst = useRef<BurstTracker | null>(null);
  /** An Enter waiting on this text's search. `triedRaw`: it already missed. */
  const waiting = useRef<{ text: string; triedRaw: boolean } | null>(null);
  const rawBusy = useRef(false);
  // Read after an await, when the render's own `query` is out of date.
  const latestQuery = useRef(query);
  useEffect(() => {
    latestQuery.current = query;
  }, [query]);

  // `alwaysOpen` keeps the list mounted regardless of focus (modal pickers).
  const open = alwaysOpen || (focused && query.trim().length > 0);

  // RN Web's Modal moves focus into itself just after mount, which beats the
  // autoFocus attribute of anything rendered inside it.
  useEffect(() => {
    if (!autoFocus || Platform.OS !== "web") return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const pick = (i: number) => {
    const item = items[i];
    if (!item) return;
    onSelect(item.value, item);
    onQueryChange("");
    setHi(-1);
    // A mouse pick took focus away; the next keystroke still belongs here.
    if (!alwaysOpen) inputRef.current?.focus();
  };

  /** Scanned text leaves the box at once, or the next scan lands on top of it. */
  const submitBurst = async (text: string) => {
    onQueryChange("");
    if (!onSubmitRaw || (await onSubmitRaw(text))) return;
    // Typed fast, not scanned: hand it back and let the search answer.
    if (latestQuery.current.trim()) {
      onRawMiss?.(text);
      return;
    }
    waiting.current = { text, triedRaw: true };
    onQueryChange(text);
  };

  const submitTyped = async (text: string) => {
    if (!onSubmitRaw || rawBusy.current) return;
    rawBusy.current = true;
    try {
      const done = await onSubmitRaw(text);
      if (!done) onRawMiss?.(text);
      else if (latestQuery.current.trim() === text) onQueryChange("");
    } finally {
      rawBusy.current = false;
    }
  };

  // Settles an Enter that was waiting for its search.
  useEffect(() => {
    const w = waiting.current;
    if (!w || loading) return;
    waiting.current = null;
    if (query.trim() !== w.text) return; // typed on: that Enter no longer applies
    if (items.length > 0) {
      const item = items[topIndex(items, w.text)];
      onSelect(item.value, item);
      onQueryChange("");
    } else if (w.triedRaw) onRawMiss?.(w.text);
    else void submitTyped(w.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires as the search settles
  }, [loading, items, query]);

  const onKeyPress = (e: {
    nativeEvent: {
      key: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
    };
    timeStamp?: number;
    preventDefault?: () => void;
  }) => {
    const { key, ctrlKey, metaKey, altKey } = e.nativeEvent;
    const at = e.timeStamp ?? Date.now();
    burst.current ??= new BurstTracker();
    if (key === "ArrowDown") {
      e.preventDefault?.();
      setHi((h) => Math.min(h + 1, items.length - 1));
    } else if (key === "ArrowUp") {
      e.preventDefault?.();
      setHi((h) => Math.max(h - 1, 0));
    } else if (key === "Enter") {
      if (ctrlKey || metaKey) return; // the screen's own shortcut
      const text = query.trim();
      const action = enterAction({
        text,
        highlighted: hi,
        itemCount: items.length,
        loading: Boolean(loading),
        burst: burst.current.isScan(at),
        hasRaw: Boolean(onSubmitRaw),
        topIndex: topIndex(items, text),
      });
      burst.current.reset();
      if (action.kind === "pick") pick(action.index);
      else if (action.kind === "raw") {
        waiting.current = null;
        // A slow typist's raw try keeps the text until the answer is in.
        if (loading) void submitBurst(text);
        else void submitTyped(text);
      } else if (action.kind === "wait") {
        waiting.current = { text, triedRaw: false };
      }
    } else if (key === "Escape") {
      waiting.current = null;
      onQueryChange("");
      setHi(-1);
    } else if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
      burst.current.char(key, at);
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
          ref={inputRef}
          nativeID={nativeID}
          // The default blurs on Enter, which dropped focus to <body> after
          // every add and sent the next keystroke nowhere.
          blurOnSubmit={false}
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
