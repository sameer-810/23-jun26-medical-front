import { useEffect } from "react";
import { Platform, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
/**
 * One family, three weights.
 *
 * Poppins used to carry the headings. A geometric display face beside data type
 * is the clearest "consumer app" tell there is, and every business tool this
 * product is measured against (Stripe, Linear, Shopify, Vercel) ships a single
 * grotesque and gets hierarchy from size and colour instead. Dropping it also
 * takes two font files off the initial web load.
 */
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";

import RootNavigator from "@navigation/RootNavigator";
import { palette } from "@shared/designSystem";

/** Browser tab and desktop window title before a screen names itself. */
const APP_TITLE = "Plusveda — Inventory & Sales";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

/**
 * URL <-> route mapping.
 *
 * This is the half that makes the web build behave like a web app: the address
 * bar follows the section, a refresh restores it, and back/forward work. It only
 * does anything because the sections are real drawer routes — a linking config
 * over a hand-rolled `useState` switch (as this app had) is decoration.
 *
 * Every section is listed: an unmapped route silently falls back to the initial
 * one on reload, which is the bug this replaces.
 */
const linking = {
  prefixes: [],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: "login",
          Signup: "signup",
          ForgotPassword: "forgot-password",
          ResetPassword: "reset-password",
        },
      },
      // Platform console (superadmin) — its own URL space under /admin.
      Admin: {
        path: "admin",
        screens: {
          AdminLogin: "login",
          AdminDashboard: "",
          AdminPharmacyDetail: "pharmacies/:id",
          AdminCreatePharmacy: "pharmacies/new",
          AdminEditPharmacy: "pharmacies/:id/edit",
          AdminPharmacyUsers: "pharmacies/:id/users",
          AdminCatalog: "catalogue",
          AdminCatalogForm: "catalogue/edit",
          AdminPlans: "plans",
          AdminPlanForm: "plans/edit",
          AdminAdmins: "admins",
          AdminAdminForm: "admins/edit",
          AdminAudit: "audit",
        },
      },
      App: {
        screens: {
          Dashboard: "dashboard",
          Warehouse: "warehouse",
          Transfers: "transfers",
          Expiry: "expiry",
          Damaged: "damaged",
          Search: "search",
          Reports: "reports",
          AuditLog: "audit-logs",
          Settings: "settings",
          Reminders: "reminders",
          Profile: "profile",

          // Sections that host a nested stack must map their children too.
          // Otherwise the stack appends its route name (/inventory/InventoryList),
          // that path matches nothing on reload, and you land back on Dashboard —
          // which is exactly the bug this config exists to kill. The index screen
          // maps to "" so the section keeps a clean URL.
          Products: {
            path: "products",
            screens: { ProductsList: "", ProductForm: "edit/:id?" },
          },
          Inventory: {
            path: "inventory",
            screens: {
              InventoryList: "",
              ProductInventory: ":id",
              ProductLedger: ":id/ledger",
              Alternatives: ":id/alternatives",
            },
          },
          ShortBook: "shortbook",
          MedGuide: {
            path: "medguide",
            screens: {
              MedGuideSearch: "",
              MedicineDetail: ":id",
            },
          },
          Orders: {
            path: "orders",
            screens: {
              OrdersList: "",
              OrderForm: "new",
              OrderDetail: ":id",
            },
          },
          Receive: {
            path: "receive-stock",
            screens: {
              ReceiveStock: "",
              Receipts: "history",
              ReceiptDetail: "history/:id",
              PurchaseReturn: "history/:id/return",
              ScanBill: "scan",
            },
          },
          Sales: {
            path: "sales",
            screens: { SalesList: "", NewSale: "new", SaleDetail: ":id" },
          },
          Customers: {
            path: "customers",
            screens: {
              CustomersList: "",
              CustomerForm: "edit/:id?",
              CustomerDetail: ":id",
            },
          },
          Suppliers: {
            path: "suppliers",
            screens: {
              SuppliersList: "",
              SupplierForm: "edit/:id?",
              SupplierDetail: ":id",
            },
          },
          PDC: "pdc",
          Team: {
            path: "team",
            screens: { TeamList: "", AddUser: "add", UserDetail: ":id" },
          },
        },
      },
    },
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = APP_TITLE;
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.surface.secondary }} />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <NavigationContainer
            linking={linking as never}
            /**
             * Without this, the container overwrites the title set above with
             * the active screen's `options.title` — which most screens don't
             * declare, leaving the browser tab (and the desktop window's title
             * bar) reading the literal word "undefined".
             *
             * Deliberately constant rather than per-screen: the formatter is
             * handed the previous route's options on a nested navigator, so
             * naming the screen labelled the tab "Products" while the dashboard
             * was open. A title that is one screen behind is worse than one
             * that never changes.
             */
            documentTitle={{ formatter: () => APP_TITLE }}
          >
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
