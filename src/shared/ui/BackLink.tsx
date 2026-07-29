/**
 * BackLink — the standard "← Back" affordance for nested detail screens (whose
 * stacks run headerShown:false). Replaces the hand-built Pressable+ArrowLeft+
 * Text that was copy-pasted across detail screens, and adds the a11y role/label
 * those hand-rolled versions lacked.
 */
import React from "react";
import { Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { palette } from "../designSystem";
import { Text } from "./Text";
import { HStack } from "./Stack";

interface Props {
  label?: string;
  onPress: () => void;
}

export function BackLink({ label = "Back", onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ marginBottom: 16, alignSelf: "flex-start" }}
    >
      <HStack gap={6} align="center">
        <ArrowLeft size={18} color={palette.text.link} strokeWidth={2} />
        <Text variant="label" tone="link">
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
}
