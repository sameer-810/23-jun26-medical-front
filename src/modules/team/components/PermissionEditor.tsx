import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { PERMISSION_META } from "@shared/permissions";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack } from "@shared/ui";

interface Props {
  available: string[]; // assignable permission keys (from server catalogue)
  selected: string[];
  onToggle: (key: string) => void;
}

/** Groups assignable permissions by category with check-toggle rows (SOW §6). */
export function PermissionEditor({ available, selected, onToggle }: Props) {
  const groups = available.reduce<Record<string, string[]>>((acc, key) => {
    const group = PERMISSION_META[key]?.group || "Other";
    (acc[group] ||= []).push(key);
    return acc;
  }, {});

  return (
    <VStack gap={18}>
      {Object.entries(groups).map(([group, keys]) => (
        <VStack key={group} gap={8}>
          <Text variant="overline" tone="tertiary">
            {group}
          </Text>
          <VStack gap={8}>
            {keys.map((key) => {
              const meta = PERMISSION_META[key];
              const on = selected.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => onToggle(key)}
                  // The tick is drawn, not a real <input>, so on web the row
                  // read as an unlabelled clickable div: a screen reader
                  // announced the permission name with no on/off state, and
                  // nothing said it could be toggled.
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={meta?.label || key}
                  accessibilityHint={meta?.description}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <HStack gap={12} align="center" flex={1}>
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on && (
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </View>
                    <VStack gap={1} flex={1}>
                      <Text variant="label-lg" tone="primary">
                        {meta?.label || key}
                      </Text>
                      {meta?.description ? (
                        <Text variant="caption" tone="tertiary">
                          {meta.description}
                        </Text>
                      ) : null}
                    </VStack>
                  </HStack>
                </Pressable>
              );
            })}
          </VStack>
        </VStack>
      ))}
    </VStack>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.default,
    backgroundColor: palette.surface.primary,
  },
  rowOn: { borderColor: palette.teal[400], backgroundColor: palette.teal[50] },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: palette.border.strong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface.primary,
  },
  checkOn: {
    backgroundColor: palette.teal[700],
    borderColor: palette.teal[700],
  },
});
