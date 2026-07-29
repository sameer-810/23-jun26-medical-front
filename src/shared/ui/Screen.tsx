import React from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { palette, layout } from "../designSystem";
import { useBottomPadding } from "./useBottomPadding";
import { Text } from "./Text";
import { VStack } from "./Stack";

interface Props {
  title?: string;
  subtitle?: string;
  overline?: string;
  right?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Screen — standard content container. Centers content to a max width on wide
 * (web/desktop) layouts and pads/scrolls consistently. The surrounding shell
 * (sidebar/tab bar) is provided by the navigator, so Screen handles only the
 * inner content region.
 */
export function Screen({
  title,
  subtitle,
  overline,
  right,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  children,
}: Props) {
  const bottom = useBottomPadding(32);
  const { width } = useWindowDimensions();
  // On a phone, actions sitting beside the title squeeze the subtitle into a
  // ragged column — drop them onto their own line instead.
  const stackHeader = width < 700;

  const header = (title || right) && (
    <View
      style={{
        flexDirection: stackHeader ? "column" : "row",
        alignItems: stackHeader ? "stretch" : "flex-end",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 12,
      }}
    >
      <VStack gap={3} flex={stackHeader ? undefined : 1}>
        {overline ? (
          <Text variant="overline" tone="tertiary">
            {overline}
          </Text>
        ) : null}
        {title ? (
          <Text variant="h1" tone="primary">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="body-sm" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      {right ? <View>{right}</View> : null}
    </View>
  );

  const inner = (
    <View
      style={[
        {
          width: "100%",
          maxWidth: layout.contentMaxWidth,
          alignSelf: "center",
        },
        contentStyle,
      ]}
    >
      {header}
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.secondary,
          padding: 24,
        }}
      >
        {inner}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.surface.secondary }}
      contentContainerStyle={{ padding: 24, paddingBottom: bottom }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={palette.teal[600]}
          />
        ) : undefined
      }
    >
      {inner}
    </ScrollView>
  );
}
