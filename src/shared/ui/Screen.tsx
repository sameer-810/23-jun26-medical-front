import React from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { LANDING_SCREENS } from "@navigation/navItems";
import { palette, layout } from "../designSystem";
import { useBottomPadding, useTabBottomPadding } from "./useBottomPadding";
import { Text } from "./Text";
import { VStack } from "./Stack";
import { BackLink } from "./BackLink";

interface Props {
  title?: string;
  subtitle?: string;
  overline?: string;
  right?: React.ReactNode;
  /**
   * The "← Back" affordance.
   *
   *  - omitted  → decided automatically (see `useAutoBack`): shown on any screen
   *               opened on top of another, hidden on the ones the sidebar goes
   *               straight to.
   *  - a string → shown with that wording ("Back to receipt"), which is kinder
   *               than a bare "Back" when the screen has several ways in.
   *  - false    → suppressed, for the rare screen that must not be left this way.
   */
  back?: string | false;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Pinned to the screen, outside the scroller — for a floating button that
   * must stay put while the page moves under it.
   *
   * Passing such a thing as a child does not work: it lands inside the
   * ScrollView, where `position: absolute; bottom: 0` anchors to the bottom of
   * the *content* rather than the viewport, so it sits below the fold and is
   * never seen. That is exactly what happened to the Home scan button.
   */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Should this screen offer a way back, and where to?
 *
 * Decided from WHERE THE SCREEN SITS, not from navigation history. A screen the
 * sidebar lands on (Dashboard, Receive Stock, Sales…) has nothing behind it and
 * gets no link; anything else was opened on top of something and gets one.
 *
 * History is deliberately not the test. A page reload has none — so on the web
 * and desktop builds, refreshing while on Scan a bill left the link out and the
 * pharmacist genuinely stuck. When there is no history to pop, this walks to the
 * section's own landing screen instead, which is where "back" meant anyway.
 *
 * This lives in Screen because the alternative — asking all 58 screens to
 * remember — is exactly what produced the complaint: Scan a bill, New sale and
 * six others had no way out but the browser's own back button, which neither
 * the desktop app nor the APK has.
 */
function useAutoBack(): (() => void) | null {
  const navigation = useNavigation();
  const routeName = useNavigationState((s) =>
    s ? s.routes[s.index]?.name : undefined,
  );
  // How deep we are in our OWN stack. Zero means we were opened cold — by URL,
  // by a reload, or from the ⌘K palette — so there is nothing of ours to pop.
  const depth = useNavigationState((s) =>
    s?.type === "stack" ? (s.index ?? 0) : 0,
  );
  // The landing screen of that stack: where "back" means, when popping can't.
  const parent = useNavigationState((s) =>
    s?.type === "stack"
      ? s.routeNames.find((n: string) => LANDING_SCREENS.has(n))
      : undefined,
  );

  if (!routeName || LANDING_SCREENS.has(routeName)) return null;
  return () => {
    // Popping is only right while there is something of ours underneath —
    // "Back to receipt" from a purchase return must land on the receipt.
    if (depth > 0 && navigation.canGoBack()) navigation.goBack();
    // Otherwise go where the label says. Popping here would leave the section
    // altogether and drop the pharmacist on the dashboard, which is not what
    // "Back to receive" promises.
    else if (parent) navigation.navigate(parent as never);
    else if (navigation.canGoBack()) navigation.goBack();
  };
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
  back,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  overlay,
  children,
}: Props) {
  const { width } = useWindowDimensions();
  /**
   * Reserve the room the phone's floating Scan button occupies.
   *
   * It is positioned absolutely, so it takes no layout space and simply covers
   * whatever is beneath it — on the billing screen that was the totals card,
   * with "Subtotal" and the grand total sitting underneath a green circle.
   * `useTabBottomPadding` existed for exactly this and nothing was calling it.
   *
   * Only on narrow layouts: ScanFab hides itself at `wideBreakpoint`, and
   * padding a desktop page for a button that isn't there leaves dead space.
   */
  const phoneBottom = useTabBottomPadding(16);
  const deskBottom = useBottomPadding(32);
  const wide = width >= layout.wideBreakpoint;
  const bottom = wide ? deskBottom : phoneBottom;
  /**
   * Page gutter. 24px on a 390px phone spends 12% of the screen width on
   * nothing, which is a real part of why the phone build felt so empty and ran
   * so long — every list was squeezed into 342px of usable width.
   */
  const gutter = wide ? layout.screenPadding : layout.screenPaddingPhone;
  // On a phone, actions sitting beside the title squeeze the subtitle into a
  // ragged column — drop them onto their own line instead.
  const stackHeader = width < 700;

  const goBack = useAutoBack();
  // Sits above the title, so it lands in the same place on every screen.
  const backLink =
    back === false || !goBack ? null : (
      <BackLink label={back || "Back"} onPress={goBack} />
    );

  /**
   * Page header.
   *
   * This used to be a three-line stack — an uppercase overline, a 23px title
   * and a subtitle — with 20px under it, on every one of 58 screens. On a phone
   * that is ~250px of masthead before the user sees a single medicine, and the
   * overline nearly always restated the sidebar section they had just tapped
   * ("CATALOGUE / Products"). The title alone carries it; the subtitle is kept
   * for the screens that use it to explain a workflow, and the overline is
   * dropped on phones where the app bar already names the section.
   */
  const header = (title || right) && (
    <View
      style={{
        flexDirection: stackHeader ? "column" : "row",
        alignItems: stackHeader ? "stretch" : "center",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 10,
      }}
    >
      <VStack gap={1} flex={stackHeader ? undefined : 1}>
        {overline && wide ? (
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
      {backLink}
      {header}
      {children}
    </View>
  );

  const scroller = !scroll ? (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface.secondary,
        padding: gutter,
      }}
    >
      {inner}
    </View>
  ) : (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.surface.secondary }}
      contentContainerStyle={{ padding: gutter, paddingBottom: bottom }}
      showsVerticalScrollIndicator={false}
      /**
       * Without this, the first tap while the keyboard is open only dismisses
       * it — every button below a text field needed tapping twice.
       */
      keyboardShouldPersistTaps="handled"
      // iOS: keep the focused field above the keyboard as it opens.
      automaticallyAdjustKeyboardInsets
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

  // The overlay is a sibling of the scroller, so it anchors to the screen.
  const body = overlay ? (
    <View style={{ flex: 1 }}>
      {scroller}
      {overlay}
    </View>
  ) : (
    scroller
  );

  /**
   * Keyboard handling lived only in the login screen, so on every other form —
   * Receive Stock, billing, customer details — the on-screen keyboard sat over
   * the fields being typed into and users had to dismiss it between entries.
   *
   * Screen wraps all 53 pages, so this is the one place it belongs. On web the
   * wrapper is skipped: there is no soft keyboard, and the extra flex container
   * would only complicate the desktop layout. Behaviour matches AuthLayout —
   * Android resizes the window on its own, iOS needs the padding.
   */
  if (Platform.OS === "web") return body;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );
}
