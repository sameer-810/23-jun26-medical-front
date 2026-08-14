import React from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  PackagePlus,
  Menu,
  type LucideIcon,
} from "lucide-react-native";
import { PERMISSIONS } from "@shared/permissions";
import { useAuthStore } from "@shared/store/useAuthStore";
import { palette, layout, radius } from "@shared/designSystem";
import { Text } from "@shared/ui";

interface TabDef {
  /** Drawer route to navigate to. */
  route: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  /** Routes that should light this tab up (a section's inner stack screens). */
  matches?: string[];
}

/**
 * The four destinations a pharmacy counter actually alternates between, plus
 * More.
 *
 * Chosen by frequency, not by org chart: you bill, you take delivery, you check
 * stock, and you glance at what needs attention. Everything else — suppliers,
 * cheques, transfers, reports, settings, the other fifteen — is a place you go
 * occasionally and deliberately, which is what the drawer is genuinely good at.
 */
const TABS: TabDef[] = [
  {
    route: "Dashboard",
    label: "Home",
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    route: "Sales",
    label: "Sell",
    icon: ShoppingCart,
    permission: PERMISSIONS.SALES_MANAGE,
    matches: ["NewSale", "SalesList", "SaleDetail"],
  },
  {
    route: "Inventory",
    label: "Stock",
    icon: Boxes,
    permission: PERMISSIONS.INVENTORY_VIEW,
    matches: ["InventoryList", "ProductInventory", "ShortBook"],
  },
  {
    route: "Receive",
    label: "Receive",
    icon: PackagePlus,
    permission: PERMISSIONS.STOCK_INWARD_MANAGE,
    matches: ["ReceiveStock", "Receipts", "ScanBill"],
  },
];

interface Props {
  /** The drawer route currently showing. */
  activeRoute: string;
  onNavigate: (route: string) => void;
  onOpenMore: () => void;
}

/**
 * PhoneTabBar — primary navigation on phones.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every section of this app used to live behind a hamburger holding 23 items.
 * Two things are wrong with that, and only one of them is fashion:
 *
 *  1. Google formally deprecated the navigation drawer in the Material 3
 *     Expressive update (2025) — "use an expanded navigation rail", which is a
 *     tablet/desktop component, leaving the navigation bar as the phone answer.
 *     Their guidance is three to five destinations of equal importance.
 *  2. Nielsen Norman's hidden-navigation study found hiding primary navigation
 *     roughly halves discoverability, and they reaffirmed that finding in June
 *     2025 while conceding that the icon itself is now well recognised. The
 *     problem was never the glyph; it is that out of sight is out of mind.
 *
 * What this is NOT justified by, despite what most design blogs claim: thumb
 * reachability. That literature traces back to a 2013 study of how people GRIP
 * phones, illustrated by a heat map its own data source later captioned "the
 * well-known, but incorrect thumb-sweep chart". Hoober's measured position and
 * NN/g's both point at the MIDDLE of the screen as most tappable. Bottom
 * placement here is convention and discoverability, not ergonomics — worth
 * being honest about, because the fake rationale invites fake conclusions.
 *
 * Implementation note: this is a presentational bar over the existing drawer
 * navigator rather than a `createBottomTabNavigator`. Swapping navigators would
 * have rewritten routing, deep links, the URL scheme and the permission gating
 * for 23 registered routes to change where five buttons sit. Expo's own native
 * tabs are still alpha, and react-navigation's native bottom tabs live under an
 * `/unstable` import path. Drawing the bar and calling `navigate()` gets the
 * pattern without betting the routing layer on it.
 */
export function PhoneTabBar({ activeRoute, onNavigate, onOpenMore }: Props) {
  const insets = useSafeAreaInsets();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const visible = TABS.filter(
    (t) => !t.permission || hasPermission(t.permission),
  );

  // A single-destination bar is just a label. Fall back to the drawer alone.
  if (visible.length < 2) return null;

  const isActive = (t: TabDef) =>
    activeRoute === t.route || Boolean(t.matches?.includes(activeRoute));
  const moreActive = !visible.some(isActive);

  const cell = (
    key: string,
    label: string,
    Icon: LucideIcon,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {/*
        The active pill is the non-colour half of the selected signal — colour
        alone would leave a colour-blind user with five identical icons.
      */}
      <View style={[styles.iconWrap, active ? styles.iconWrapActive : null]}>
        <Icon
          size={20}
          color={active ? palette.teal[700] : palette.text.tertiary}
          strokeWidth={active ? 2.3 : 2}
        />
      </View>
      <Text
        variant="label-sm"
        numberOfLines={1}
        // Capped hard: this label sits in a fixed-width fifth of the screen,
        // and past ~1.2x it truncates rather than informs.
        maxFontSizeMultiplier={1.2}
        style={{
          color: active ? palette.teal[700] : palette.text.tertiary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}
      accessibilityRole="tablist"
    >
      {visible.map((t) =>
        cell(t.route, t.label, t.icon, isActive(t), () => onNavigate(t.route)),
      )}
      {cell("__more", "More", Menu, moreActive, onOpenMore)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 6,
    backgroundColor: palette.surface.primary,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
    // The bar is the one piece of chrome that genuinely floats over content.
    ...Platform.select({
      web: { boxShadow: "0 -1px 3px rgba(15,31,27,0.05)" },
      default: {},
    }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    // 44 before the safe-area inset — the Apple touch floor, which the old
    // 34px row actions missed.
    minHeight: 44,
    paddingHorizontal: 2,
  },
  iconWrap: {
    minWidth: 46,
    height: 26,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: palette.teal[50],
  },
});

/** Height the bar occupies, for content that must clear it. */
export const PHONE_TAB_BAR_HEIGHT = layout.tabBarHeight;

/**
 * Whether the tab bar will actually render for this user.
 *
 * The app bar's hamburger is kept only when it won't — with a "More" tab
 * present, two controls opening the same drawer is clutter, but a user whose
 * permissions leave fewer than two tabs must still have a way in. Losing the
 * only route to the menu is a far worse bug than a redundant button.
 */
export function useHasPhoneTabs(): boolean {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return (
    TABS.filter((t) => !t.permission || hasPermission(t.permission)).length >= 2
  );
}
