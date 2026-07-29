/**
 * Banner — inline status message (error / warning / info / success). Replaces
 * the ad-hoc `errorBox` / `warnBox` style objects hand-rolled across screens
 * with one tone-aware, icon-led component.
 */
import React from "react";
import { View } from "react-native";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react-native";
import { palette, radius } from "../designSystem";
import { Text } from "./Text";
import { HStack, VStack } from "./Stack";

type Tone = "danger" | "warning" | "info" | "success";

const TONE: Record<
  Tone,
  { bg: string; border: string; text: string; icon: LucideIcon }
> = {
  danger: { ...palette.danger, icon: AlertCircle },
  warning: { ...palette.warning, icon: AlertTriangle },
  info: { ...palette.info, icon: Info },
  success: { ...palette.success, icon: CheckCircle2 },
};

interface Props {
  tone?: Tone;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  style?: object;
}

export function Banner({
  tone = "info",
  title,
  message,
  children,
  style,
}: Props) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <View
      style={[
        {
          padding: 14,
          borderRadius: radius.md,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.border,
        },
        style,
      ]}
    >
      <HStack gap={10} align="flex-start">
        <Icon size={18} color={t.text} strokeWidth={2.2} />
        <VStack gap={2} flex={1}>
          {title ? (
            <Text variant="label" style={{ color: t.text }}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text variant="body-sm" style={{ color: t.text }}>
              {message}
            </Text>
          ) : null}
          {children}
        </VStack>
      </HStack>
    </View>
  );
}
