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
      hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      /**
       * Real padding, cancelled by negative margin — the link still sits flush
       * where it was, but the box you can hit is 34px instead of 18. `hitSlop`
       * alone was not enough: react-native-web drops it, so on the counter PC
       * and the Electron build the target stayed the height of the text.
       */
      style={{
        alignSelf: "flex-start",
        paddingVertical: 8,
        paddingRight: 8,
        marginBottom: 8,
      }}
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
