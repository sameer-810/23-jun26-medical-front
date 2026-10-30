/**
 * Every section that loads as its own chunk. The Dashboard and the Sales stack
 * are not here: they are what a signed-in pharmacist sees first, and they ship
 * in the main bundle.
 *
 * Order is preload order, so the screens that keep working offline (they read
 * the local mirror, see shared/offline/offlineFallbacks.ts) come first: if the
 * tab only stays open a moment, those are the ones already cached.
 */
import { lazyScreen, preloadAlso } from "./lazyScreen";

export const ProductsNavigator = lazyScreen(
  () => import("@modules/product/ProductsNavigator"),
);
export const InventoryNavigator = lazyScreen(
  () => import("@modules/inventory/InventoryNavigator"),
);
export const CustomersNavigator = lazyScreen(
  () => import("@modules/customer/CustomersNavigator"),
);
export const SettingsScreen = lazyScreen(
  () => import("@modules/settings/screens/SettingsScreen"),
);
export const ReceivingNavigator = lazyScreen(
  () => import("@modules/inventory/ReceivingNavigator"),
);
export const SearchScreen = lazyScreen(
  () => import("@modules/inventory/screens/SearchScreen"),
);
export const ShortBookScreen = lazyScreen(
  () => import("@modules/inventory/screens/ShortBookScreen"),
);
export const ExpiryScreen = lazyScreen(
  () => import("@modules/expiry/screens/ExpiryScreen"),
);
export const WarehouseScreen = lazyScreen(
  () => import("@modules/warehouse/screens/WarehouseScreen"),
);
export const PurchaseOrdersNavigator = lazyScreen(
  () => import("@modules/purchaseOrder/PurchaseOrdersNavigator"),
);
export const MedGuideNavigator = lazyScreen(
  () => import("@modules/medguide/MedGuideNavigator"),
);
export const SuppliersNavigator = lazyScreen(
  () => import("@modules/supplier/SuppliersNavigator"),
);
export const PdcScreen = lazyScreen(
  () => import("@modules/cheque/screens/PdcScreen"),
);
export const DamagedScreen = lazyScreen(
  () => import("@modules/stockops/screens/DamagedScreen"),
);
export const TransfersScreen = lazyScreen(
  () => import("@modules/stockops/screens/TransfersScreen"),
);
export const ReportsScreen = lazyScreen(
  () => import("@modules/reports/screens/ReportsScreen"),
);
export const TeamNavigator = lazyScreen(
  () => import("@modules/team/TeamNavigator"),
);
export const AuditLogScreen = lazyScreen(
  () => import("@modules/team/screens/AuditLogScreen"),
);
export const ProfileScreen = lazyScreen(
  () => import("@modules/profile/screens/ProfileScreen"),
);
export const RemindersScreen = lazyScreen(
  () => import("@modules/reminder/screens/RemindersScreen"),
);
export const PricingScreen = lazyScreen(
  () => import("@modules/pricing/screens/PricingScreen"),
);

// Shelf labels reprint offline; the encoder is no longer in the main bundle.
preloadAlso(() => import("bwip-js/browser"));

// Reached only from a link or with no session, so never worth preloading.
export const AdminNavigator = lazyScreen(
  () => import("@navigation/AdminNavigator"),
  { preload: false },
);
export const SignupScreen = lazyScreen(
  () => import("@modules/auth/screens/SignupScreen"),
  { preload: false },
);
export const ForgotPasswordScreen = lazyScreen(
  () => import("@modules/auth/screens/ForgotPasswordScreen"),
  { preload: false },
);
export const ResetPasswordScreen = lazyScreen(
  () => import("@modules/auth/screens/ResetPasswordScreen"),
  { preload: false },
);
