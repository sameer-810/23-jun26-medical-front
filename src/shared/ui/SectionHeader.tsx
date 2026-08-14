import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Text } from "./Text";

interface Props {
  title: string;
  /** A count or short qualifier, set quietly beside the title. */
  count?: string | number;
  /** One action, at the end of the line. Keep it to a small/plain button. */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * SectionHeader — the label above a block of content.
 *
 * Screens were setting these by hand with `marginTop: 28, marginBottom: 12`
 * around an `h3`, which is where a lot of the page's dead space came from. One
 * component, one rhythm: 20 above, 8 below, and any section action sits on the
 * same line rather than adding another row.
 */
export function SectionHeader({ title, count, action, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.titleRow}>
        <Text variant="h3" tone="primary">
          {title}
        </Text>
        {count != null ? (
          <Text variant="body-sm" tone="tertiary" style={{ marginLeft: 6 }}>
            {count}
          </Text>
        ) : null}
      </View>
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 8,
    minHeight: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexShrink: 1,
  },
});
