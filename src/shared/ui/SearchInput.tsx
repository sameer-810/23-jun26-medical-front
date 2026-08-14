/**
 * SearchInput — the one search field. Replaces the identical `searchWrap` +
 * bare TextInput that was hand-rolled across ~8 list screens.
 */
import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Search } from "lucide-react-native";
import { palette, radius, outline, layout } from "../designSystem";

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search…",
  autoFocus,
  onSubmitEditing,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Search size={18} color={palette.text.tertiary} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.text.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        // @ts-expect-error web-only outline reset
        style={[styles.input, { outlineStyle: "none" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    height: layout.controlHeightPhone,
    borderRadius: radius.md,
    borderWidth: outline.width,
    borderColor: outline.color,
    backgroundColor: palette.surface.primary,
  },
  input: {
    flex: 1,
    // Fill the box. At paddingVertical:0 the input itself was only 20px tall,
    // so taps landing in the surrounding padding hit nothing — the field
    // looked full height and behaved like 20px.
    alignSelf: "stretch",
    fontSize: 14,
    color: palette.text.primary,
    paddingVertical: 0,
  },
});
