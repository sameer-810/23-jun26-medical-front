import React from "react";
import { View, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { palette, radius } from "../designSystem";
import { Text } from "./Text";
import { VStack } from "./Stack";

interface Props {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
  /** For an empty state filling a whole page rather than a card. */
  large?: boolean;
}

/**
 * EmptyState — compact by default.
 *
 * The old one opened with a 76px tinted circle 64px down the page, a 16px
 * heading and a centred paragraph, which on the billing screen produced a
 * near-full-screen "No items yet" monument above the thing the pharmacist
 * actually needed. An empty state is a caption explaining why a container is
 * empty, not an illustration — it should sit inside the container it describes
 * and take about three lines.
 */
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  large = false,
}: Props) {
  return (
    <VStack
      align="center"
      gap={6}
      style={{
        paddingVertical: large ? 40 : 28,
        paddingHorizontal: 20,
      }}
    >
      <View style={styles.icon}>
        <Icon size={18} color={palette.text.disabled} strokeWidth={2} />
      </View>
      <Text variant="label" tone="secondary" align="center">
        {title}
      </Text>
      {message ? (
        <Text
          variant="body-sm"
          tone="tertiary"
          align="center"
          style={{ maxWidth: 340 }}
        >
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
    </VStack>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: palette.surface.sunken,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
});
