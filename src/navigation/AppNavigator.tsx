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
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Image,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Menu } from "lucide-react-native";
import { palette, layout, radius } from "@shared/designSystem";
import { Text, HStack } from "@shared/ui";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { PhoneTabBar, useHasPhoneTabs } from "./PhoneTabBar";
import { OfflineBanner } from "@shared/offline/OfflineBanner";
import { NAV_ITEMS, useVisibleNavItems } from "./navItems";

import DashboardScreen from "@modules/dashboard/screens/DashboardScreen";
import ProductsNavigator from "@modules/product/ProductsNavigator";
import WarehouseScreen from "@modules/warehouse/screens/WarehouseScreen";
import InventoryNavigator from "@modules/inventory/InventoryNavigator";
import ReceivingNavigator from "@modules/inventory/ReceivingNavigator";
import SearchScreen from "@modules/inventory/screens/SearchScreen";
import ShortBookScreen from "@modules/inventory/screens/ShortBookScreen";
import PurchaseOrdersNavigator from "@modules/purchaseOrder/PurchaseOrdersNavigator";
import MedGuideNavigator from "@modules/medguide/MedGuideNavigator";
import SalesNavigator from "@modules/sale/SalesNavigator";
import CustomersNavigator from "@modules/customer/CustomersNavigator";
import SuppliersNavigator from "@modules/supplier/SuppliersNavigator";
import PdcScreen from "@modules/cheque/screens/PdcScreen";
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
  Orders: PurchaseOrdersNavigator,
  MedGuide: MedGuideNavigator,
  Sales: SalesNavigator,
  Transfers: TransfersScreen,
  Expiry: ExpiryScreen,
  Damaged: DamagedScreen,
  Customers: CustomersNavigator,
  Suppliers: SuppliersNavigator,
  PDC: PdcScreen,
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
  const [activeSection, setActiveSection] = useState("Dashboard");
  /**
   * The drawer's own navigation object, captured when it renders its panel.
   *
   * The tab bar lives outside the drawer's context, so it has no navigation of
   * its own — but `drawerContent` is handed a real one, and that is the object
   * that can both `navigate` between sections and `openDrawer` for More.
   */
  const drawerNav = useRef<DrawerContentComponentProps["navigation"] | null>(
    null,
  );
  // Only routes the user may actually use get registered — so a deep link to a
  // section they lack permission for can't render its shell.
  const items = useVisibleNavItems();
  const hasTabs = useHasPhoneTabs();

  const drawerContent = (props: DrawerContentComponentProps) => {
    drawerNav.current = props.navigation;
    return (
      <Sidebar
        activeRoute={props.state.routeNames[props.state.index]}
        onNavigate={(name) => props.navigation.navigate(name)}
        collapsed={isWide && collapsed}
        onToggleCollapse={isWide ? () => setCollapsed((c) => !c) : undefined}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Drawer.Navigator
        initialRouteName="Dashboard"
        drawerContent={drawerContent}
        /**
         * Track which section is showing so the phone tab bar can highlight it.
         *
         * The bar has to render as a sibling of the navigator (it sits over the
         * content, not inside the drawer panel), which puts it outside the
         * drawer's navigation context — so it can't read the state itself. The
         * `state` event fires on every navigation, including deep links and
         * browser back, so this stays correct without polling.
         */
        screenListeners={{
          state: (e) => {
            const s = e.data?.state;
            if (!s) return;
            const name = s.routeNames[s.index];
            if (name) setActiveSection(String(name));
          },
        }}
        screenOptions={{
          // The permanent drawer IS the sidebar on desktop; phones get an app bar.
          drawerType: isWide ? "permanent" : "front",
          headerShown: !isWide,
          header: ({ route, navigation }) => (
            <SafeAreaView edges={["top"]} style={styles.appBarSafe}>
              <HStack align="center" gap={12} style={styles.appBar}>
                {/* Only when the bottom bar isn't carrying a "More" tab —
                    two controls opening the same drawer is clutter. */}
                {hasTabs ? null : (
                  <Pressable
                    onPress={() => navigation.openDrawer()}
                    hitSlop={8}
                    style={styles.menuBtn}
                    accessibilityLabel="Open menu"
                  >
                    <Menu
                      size={22}
                      color={palette.text.primary}
                      strokeWidth={2}
                    />
                  </Pressable>
                )}
                <Image
                  source={require("../../assets/brand/mark.png")}
                  style={styles.appBarLogo}
                  resizeMode="contain"
                  accessibilityLabel="Plusveda"
                />
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
      {!isWide ? (
        <PhoneTabBar
          activeRoute={activeSection}
          onNavigate={(name) => drawerNav.current?.navigate(name)}
          onOpenMore={() => drawerNav.current?.openDrawer()}
        />
      ) : null}
      <CommandPalette />
    </View>
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
  },
});
