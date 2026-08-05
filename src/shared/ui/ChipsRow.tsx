/**
 * ChipsRow — horizontal scrolling filter chips. Each chip is a FIXED-HEIGHT box
 * that centers its label inside a fixed-height container so text never clips.
 */
import React from "react";
import { ScrollView, Pressable, StyleSheet, View } from "react-native";
import { palette, radius, layout, outline } from "../designSystem";
import { Text } from "./Text";

export interface Chip {
  key: string;
  label: string;
}

interface Props {
  chips: Chip[];
  active: string;
  onChange: (key: string) => void;
}

export function ChipsRow({ chips, active, onChange }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {chips.map((c) => {
          const isActive = active === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              // A filter chip is a radio in everything but looks — announcing
              // which one is currently applied is the whole point.
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive, checked: isActive }}
              style={({ pressed }) => [
                styles.chip,
                isActive && styles.chipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: isActive ? "#FFFFFF" : palette.text.secondary }}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: layout.chipRowHeight },
  content: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  chip: {
    height: layout.chipHeight,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: palette.surface.primary,
    borderWidth: outline.width,
    borderColor: outline.color,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    // 700 (not the 600 logo green): the active chip carries a white ~14px
    // label, which needs 4.5:1 — 600 only reaches 3.4.
    backgroundColor: palette.teal[700],
    borderColor: palette.teal[700],
  },
});
