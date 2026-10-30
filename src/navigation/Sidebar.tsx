import React, { useRef, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LogOut,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { palette, radius, layout } from "@shared/designSystem";
import { Text, VStack, HStack, Avatar } from "@shared/ui";
import { NavItem, SECTION_ORDER, useSidebarNavItems } from "./navItems";

/**
 * Below this window height the full 36px nav no longer fits, so the desktop
 * sidebar tightens: 32px rows, smaller gaps, a smaller footer. Even that needs
 * about 930px for an admin's 20 rows, so a shorter window still scrolls — the
 * tightening puts everything through Reports above the fold at 768px, and the
 * "more" strip says the rest exists.
 */
const TIGHT_BELOW_HEIGHT = 1100;

/** Web only. Windows' default 15px bar takes a sixth of a 240px sidebar. */
const thinScrollbar =
  Platform.OS === "web" ? ({ scrollbarWidth: "thin" } as object) : null;

interface Props {
  activeRoute: string;
  onNavigate: (name: string) => void;
  /** Collapsed icon-rail mode (wide screens only). */
  collapsed?: boolean;
  /** Show/handle the collapse toggle (wide screens only; hidden in the mobile drawer). */
  onToggleCollapse?: () => void;
}

export function Sidebar({
  activeRoute,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const logout = useAuthStore((s) => s.logout);
  // Same list the navigator registers routes from, minus the `hidden` ones that
  // are opened from a screen rather than browsed to.
  const items = useSidebarNavItems();
  const { height } = useWindowDimensions();
  // `onToggleCollapse` marks the desktop shell. The phone drawer keeps its rows:
  // a thumb, unlike a mouse, can't use a 32px one.
  const tight = Boolean(onToggleCollapse) && height < TIGHT_BELOW_HEIGHT;

  // Measured, not assumed: scroll bars are invisible on many setups, and without
  // a cue a row cut off at the fold reads as the end of the list.
  const scrollRef = useRef<ScrollView>(null);
  const metrics = useRef({ view: 0, content: 0, y: 0 });
  const [moreBelow, setMoreBelow] = useState(false);
  const syncMore = () => {
    const { view, content, y } = metrics.current;
    setMoreBelow(content - view - y > 8);
  };
  const onNavLayout = (e: LayoutChangeEvent) => {
    metrics.current.view = e.nativeEvent.layout.height;
    syncMore();
  };
  const onNavScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    metrics.current.y = e.nativeEvent.contentOffset.y;
    syncMore();
  };
  const scrollDown = () => {
    const { view, y } = metrics.current;
    scrollRef.current?.scrollTo({ y: y + view * 0.8, animated: true });
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + (tight ? 12 : 20),
          width: collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth,
        },
      ]}
    >
      {/* Brand + collapse toggle */}
      <HStack
        gap={10}
        align="center"
        style={{
          paddingHorizontal: collapsed ? 0 : 20,
          justifyContent: collapsed ? "center" : "flex-start",
          marginBottom: tight ? 8 : 20,
        }}
      >
        {collapsed ? (
          <Image
            source={require("../../assets/brand/mark.png")}
            style={styles.mark}
            resizeMode="contain"
            accessibilityLabel="Plusveda"
          />
        ) : (
          <>
            <VStack gap={3} flex={1}>
              <Image
                source={require("../../assets/brand/wordmark.png")}
                style={styles.wordmark}
                resizeMode="contain"
                accessibilityLabel="Plusveda"
              />
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {organization?.name || "Inventory"}
              </Text>
            </VStack>
            {onToggleCollapse && (
              <Pressable
                onPress={onToggleCollapse}
                hitSlop={8}
                style={styles.toggleBtn}
                accessibilityLabel="Collapse sidebar"
              >
                <ChevronsLeft
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={2}
                />
              </Pressable>
            )}
          </>
        )}
      </HStack>

      {/* Expand button when collapsed */}
      {collapsed && onToggleCollapse && (
        <Pressable
          onPress={onToggleCollapse}
          hitSlop={8}
          style={styles.expandBtn}
          accessibilityLabel="Expand sidebar"
        >
          <ChevronsRight
            size={18}
            color={palette.text.tertiary}
            strokeWidth={2}
          />
        </Pressable>
      )}

      {/* Nav — grouped into sections so 20+ items read as an information
          architecture, not one long undifferentiated scroll. */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={[{ flex: 1 }, thinScrollbar]}
          contentContainerStyle={{ paddingHorizontal: collapsed ? 10 : 12 }}
          scrollEventThrottle={64}
          onLayout={onNavLayout}
          onScroll={onNavScroll}
          onContentSizeChange={(_, h) => {
            metrics.current.content = h;
            syncMore();
          }}
        >
          {SECTION_ORDER.map((section) => {
            const group = items.filter((it) => it.section === section);
            if (group.length === 0) return null;
            return (
              <View key={section}>
                {collapsed ? (
                  <View style={styles.sectionDivider} />
                ) : (
                  <Text
                    variant="label-sm"
                    tone="tertiary"
                    style={[
                      styles.sectionLabel,
                      tight && styles.sectionLabelTight,
                    ]}
                  >
                    {section.toUpperCase()}
                  </Text>
                )}
                {group.map((item) => (
                  <NavRow
                    key={item.name}
                    item={item}
                    active={activeRoute === item.name}
                    collapsed={collapsed}
                    tight={tight}
                    onPress={() => onNavigate(item.name)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>

        {moreBelow ? (
          <Pressable
            onPress={scrollDown}
            style={styles.moreStrip}
            accessibilityRole="button"
            accessibilityLabel="Scroll to more sections"
          >
            <ChevronDown
              size={14}
              color={palette.text.tertiary}
              strokeWidth={2}
            />
          </Pressable>
        ) : null}
      </View>

      {/* User footer */}
      <View
        style={[
          styles.footer,
          tight && styles.footerTight,
          {
            paddingBottom: insets.bottom + (tight ? 10 : 12),
            paddingHorizontal: collapsed ? 0 : 16,
            alignItems: collapsed ? "center" : "stretch",
          },
        ]}
      >
        {collapsed ? (
          <VStack gap={tight ? 6 : 10} align="center">
            <Avatar name={user?.fullName || "U"} size={tight ? 32 : 36} />
            <Pressable
              onPress={() => logout()}
              hitSlop={8}
              style={styles.logoutBtn}
              accessibilityLabel="Sign out"
            >
              <LogOut
                size={18}
                color={palette.text.tertiary}
                strokeWidth={1.8}
              />
            </Pressable>
          </VStack>
        ) : (
          <HStack gap={10} align="center">
            <Avatar name={user?.fullName || "U"} size={tight ? 32 : 38} />
            <VStack gap={1} flex={1}>
              <Text variant="label" tone="primary" numberOfLines={1}>
                {user?.fullName}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {user?.role === "admin" ? "Admin" : user?.roleLabel || "Staff"}
              </Text>
            </VStack>
            <Pressable
              onPress={() => logout()}
              hitSlop={8}
              style={styles.logoutBtn}
              accessibilityLabel="Sign out"
            >
              <LogOut
                size={18}
                color={palette.text.tertiary}
                strokeWidth={1.8}
              />
            </Pressable>
          </HStack>
        )}
      </View>
    </View>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  tight,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  tight: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={item.label}
      style={({ pressed }) => [
        styles.navRow,
        tight && styles.navRowTight,
        collapsed && styles.navRowCollapsed,
        active && styles.navRowActive,
        pressed && !active && { backgroundColor: palette.ink[50] },
      ]}
    >
      <Icon
        size={19}
        color={active ? palette.teal[700] : palette.text.tertiary}
        strokeWidth={active ? 2.2 : 1.8}
      />
      {!collapsed && (
        <Text
          variant="label-lg"
          style={{ color: active ? palette.teal[700] : palette.text.secondary }}
        >
          {item.label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Fixed-width column (width set inline per collapsed state); must NOT flex-grow
    // or it fights the explicit width and fills half the screen when collapsed.
    flexShrink: 0,
    // Fill the drawer's height so the nav ScrollView (flex:1) has a bounded
    // parent. Without this it worked on web (the drawer gave it height) but
    // collapsed to zero on native — the nav list vanished and the footer rode
    // up under the brand. height:"100%" fills vertically without touching the
    // inline width, so the permanent drawer stays fixed-width.
    height: "100%",
    backgroundColor: palette.surface.primary,
    borderRightWidth: 1,
    borderRightColor: palette.border.default,
  },
  /** Brand wordmark in the expanded sidebar (720x156 source → 4.6:1). */
  wordmark: {
    width: 138,
    height: 30,
  },
  /** Compact "p" mark shown when the rail is collapsed. */
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
  },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  expandBtn: {
    alignSelf: "center",
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.ink[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  /**
   * 36px, not 48. These rows were built at thumb size, but the sidebar only
   * exists on the desktop shell where the input is a mouse — 22 sections at
   * 48px each ran the nav well past the fold on a laptop, which is why it
   * needed scrolling to reach Sales.
   */
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: layout.navRowHeight,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginBottom: 1,
  },
  navRowTight: { height: 32 },
  navRowCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
    gap: 0,
  },
  navRowActive: { backgroundColor: palette.teal[50] },
  sectionLabel: {
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 2,
    letterSpacing: 0.6,
  },
  sectionLabelTight: { marginTop: 5, marginBottom: 0 },
  sectionDivider: {
    height: 1,
    backgroundColor: palette.border.subtle,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  footer: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  footerTight: { paddingTop: 10 },
  /** Sits over the fold of the list; solid so a half-clipped row doesn't show. */
  moreStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface.primary,
    borderTopWidth: 1,
    borderTopColor: palette.border.subtle,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
