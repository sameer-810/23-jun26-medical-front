import { useEffect } from "react";
import { Platform, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import RootNavigator from "@navigation/RootNavigator";
import { palette } from "@shared/designSystem";

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
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Plusveda — Inventory & Sales";
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
          <NavigationContainer linking={linking as never}>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
