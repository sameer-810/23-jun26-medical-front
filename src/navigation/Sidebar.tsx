import React from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Activity,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { palette, radius, layout } from "@shared/designSystem";
import { Text, VStack, HStack, Avatar } from "@shared/ui";
import { NavItem, useVisibleNavItems } from "./navItems";

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
  // Same list the navigator registers routes from — one source of truth.
  const items = useVisibleNavItems();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 20,
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
          marginBottom: 20,
        }}
      >
        <View style={styles.logo}>
          <Activity size={20} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        {!collapsed && (
          <>
            <VStack gap={1} flex={1}>
              <Text variant="h4" tone="primary" numberOfLines={1}>
                Plusveda
              </Text>
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

      {/* Nav */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: collapsed ? 10 : 12 }}
      >
        {items.map((item) => (
          <NavRow
            key={item.name}
            item={item}
            active={activeRoute === item.name}
            collapsed={collapsed}
            onPress={() => onNavigate(item.name)}
          />
        ))}
      </ScrollView>

      {/* User footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            paddingHorizontal: collapsed ? 0 : 16,
            alignItems: collapsed ? "center" : "stretch",
          },
        ]}
      >
        {collapsed ? (
          <VStack gap={10} align="center">
            <Avatar name={user?.fullName || "U"} size={36} />
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
            <Avatar name={user?.fullName || "U"} size={38} />
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
  onPress,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={item.label}
      style={({ pressed }) => [
        styles.navRow,
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
  logo: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: palette.teal[600],
    alignItems: "center",
    justifyContent: "center",
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  navRowCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
    gap: 0,
  },
  navRowActive: { backgroundColor: palette.teal[50] },
  footer: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
