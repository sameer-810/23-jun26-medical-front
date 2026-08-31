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
import { navigationRef } from "@navigation/navigationRef";
import { palette } from "@shared/designSystem";
import { startOfflineEngine } from "@shared/offline/outboxEngine";

/** Browser tab and desktop window title before a screen names itself. */
const APP_TITLE = "Plusveda — Inventory & Sales";

/**
 * `networkMode: "always"` on both halves, because this app owns its own
 * connectivity model and React Query's default fights it.
 *
 * The default ("online") gates on `navigator.onLine`. A paused MUTATION never
 * calls its `mutationFn` at all — so `useCreateSale` never reached the outbox,
 * no bill was captured, and the counter got a spinner that span forever on the
 * exact stroke offline billing exists for. Queries are the same story one step
 * down: a paused query never runs `queryFn`, so `withLocalFallback` never gets
 * to answer from the local mirror.
 *
 * `useOfflineStore` decides what "offline" means here — inferred from real
 * traffic and a /health probe — and the outbox decides what to do about it.
 * Both are strictly better informed than a browser flag that only knows
 * whether an interface is up.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      networkMode: "always",
    },
    mutations: { networkMode: "always" },
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
            screens: {
              SalesList: "",
              NewSale: "new",
              OfflineSync: "offline",
              RxRegister: "rx-register",
              SaleDetail: ":id",
            },
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
      /**
       * Offline app shell — a refresh with no network must still load the
       * till. The Electron build serves from disk and skips this naturally.
       *
       * Gated on `isSecureContext`, not on the protocol string: browsers also
       * allow service workers on http://localhost, and a `=== "https:"` test
       * excluded exactly that — so the offline shell could never be verified
       * on a local build, which is why nothing caught that it wasn't
       * registering. `isSecureContext` is the condition the browser itself
       * applies, so this asks the real question.
       */
      if ("serviceWorker" in navigator && window.isSecureContext) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    }
    // Outbox drain + connectivity judgement + invoice-series registration.
    startOfflineEngine(queryClient);
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
            ref={navigationRef}
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
