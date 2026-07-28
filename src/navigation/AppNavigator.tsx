/**
 * AppNavigator — responsive app shell.
 *
 *  - Wide screens (web / desktop ≥ wideBreakpoint): the Sidebar is a PERMANENT
 *    drawer sitting next to the content.
 *  - Narrow screens (phones): the Sidebar slides over, opened from the app bar.
 *
 * Sections are real drawer ROUTES, not local state. That's what makes the web
 * build behave like a web app: the URL tracks the section (/inventory), a
 * refresh keeps you where you were, browser back/forward work, and links are
 * shareable. `linking` in App.tsx maps each route to its path — both halves are
 * required, and either alone does nothing.
 */
import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Menu, Activity } from "lucide-react-native";
import { palette, layout, radius } from "@shared/designSystem";
import { Text, HStack } from "@shared/ui";
import { Sidebar } from "./Sidebar";
import { NAV_ITEMS, useVisibleNavItems } from "./navItems";

import DashboardScreen from "@modules/dashboard/screens/DashboardScreen";
import ProductsNavigator from "@modules/product/ProductsNavigator";
import WarehouseScreen from "@modules/warehouse/screens/WarehouseScreen";
import InventoryNavigator from "@modules/inventory/InventoryNavigator";
import ReceivingNavigator from "@modules/inventory/ReceivingNavigator";
import SearchScreen from "@modules/inventory/screens/SearchScreen";
import ShortBookScreen from "@modules/inventory/screens/ShortBookScreen";
import SalesNavigator from "@modules/sale/SalesNavigator";
import CustomersNavigator from "@modules/customer/CustomersNavigator";
import SuppliersNavigator from "@modules/supplier/SuppliersNavigator";
import ExpiryScreen from "@modules/expiry/screens/ExpiryScreen";
import DamagedScreen from "@modules/stockops/screens/DamagedScreen";
import TransfersScreen from "@modules/stockops/screens/TransfersScreen";
import ReportsScreen from "@modules/reports/screens/ReportsScreen";
import TeamNavigator from "@modules/team/TeamNavigator";
import AuditLogScreen from "@modules/team/screens/AuditLogScreen";
import SettingsScreen from "@modules/settings/screens/SettingsScreen";
import ProfileScreen from "@modules/profile/screens/ProfileScreen";
import RemindersScreen from "@modules/reminder/screens/RemindersScreen";

/**
 * Jumps to another top-level section by name.
 *
 * Kept as a hook with the original name so screens using it don't change. It
 * resolves through react-navigation now: `navigate` bubbles up from a nested
 * stack to the drawer when the route isn't local, so this works from any depth.
 */
export const useSectionNav = () => {
  const navigation = useNavigation<{ navigate: (n: string) => void }>();
  return useCallback((name: string) => navigation.navigate(name), [navigation]);
};

/** Section name -> screen. Kept here (not in navItems) to avoid an import cycle. */
const SCREENS: Record<string, React.ComponentType> = {
  Dashboard: DashboardScreen,
  Products: ProductsNavigator,
  Warehouse: WarehouseScreen,
  Inventory: InventoryNavigator,
  ShortBook: ShortBookScreen,
  Receive: ReceivingNavigator,
  Sales: SalesNavigator,
  Transfers: TransfersScreen,
  Expiry: ExpiryScreen,
  Damaged: DamagedScreen,
  Customers: CustomersNavigator,
  Suppliers: SuppliersNavigator,
  Search: SearchScreen,
  Reports: ReportsScreen,
  Team: TeamNavigator,
  AuditLog: AuditLogScreen,
  Settings: SettingsScreen,
  Reminders: RemindersScreen,
  Profile: ProfileScreen,
};

const Drawer = createDrawerNavigator();

export default function AppNavigator() {
  const { width } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  const [collapsed, setCollapsed] = useState(false);
  // Only routes the user may actually use get registered — so a deep link to a
  // section they lack permission for can't render its shell.
  const items = useVisibleNavItems();

  const drawerContent = (props: DrawerContentComponentProps) => (
    <Sidebar
      activeRoute={props.state.routeNames[props.state.index]}
      onNavigate={(name) => props.navigation.navigate(name)}
      collapsed={isWide && collapsed}
      onToggleCollapse={isWide ? () => setCollapsed((c) => !c) : undefined}
    />
  );

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={drawerContent}
      screenOptions={{
        // The permanent drawer IS the sidebar on desktop; phones get an app bar.
        drawerType: isWide ? "permanent" : "front",
        headerShown: !isWide,
        header: ({ route, navigation }) => (
          <SafeAreaView edges={["top"]} style={styles.appBarSafe}>
            <HStack align="center" gap={12} style={styles.appBar}>
              <Pressable
                onPress={() => navigation.openDrawer()}
                hitSlop={8}
                style={styles.menuBtn}
                accessibilityLabel="Open menu"
              >
                <Menu size={22} color={palette.text.primary} strokeWidth={2} />
              </Pressable>
              <View style={styles.appBarLogo}>
                <Activity size={16} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <Text variant="h4" tone="primary">
                {NAV_ITEMS.find((i) => i.name === route.name)?.label ||
                  "Plusveda"}
              </Text>
            </HStack>
          </SafeAreaView>
        ),
        drawerStyle: {
          width:
            isWide && collapsed
              ? layout.sidebarCollapsedWidth
              : layout.sidebarWidth,
          // The Sidebar draws its own right border.
          borderRightWidth: 0,
        },
        overlayColor: "rgba(15,23,42,0.4)",
        sceneStyle: { backgroundColor: palette.surface.secondary },
      }}
    >
      {items.map((item) => {
        const Component = SCREENS[item.name];
        if (!Component) return null;
        return (
          <Drawer.Screen
            key={item.name}
            name={item.name}
            component={Component}
            options={{ title: item.label }}
          />
        );
      })}
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  appBarSafe: { backgroundColor: palette.surface.primary },
  appBar: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: palette.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.default,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarLogo: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: palette.teal[600],
    alignItems: "center",
    justifyContent: "center",
  },
});
