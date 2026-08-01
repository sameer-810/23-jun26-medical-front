import {
  LayoutDashboard,
  Package,
  Warehouse,
  Boxes,
  ListChecks,
  PackagePlus,
  ShoppingBag,
  Search,
  ShoppingCart,
  Contact,
  Truck,
  CalendarClock,
  AlarmClock,
  ShieldAlert,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Users,
  ScrollText,
  Settings,
  UserRound,
  BellRing,
  type LucideIcon,
} from "lucide-react-native";
import { PERMISSIONS } from "@shared/permissions";
import { useAuthStore } from "@shared/store/useAuthStore";

export type NavSection =
  | "Overview"
  | "Catalogue"
  | "Inventory"
  | "Purchasing"
  | "Sales"
  | "Insights"
  | "Workspace";

/** Sidebar section order (Vyapar-style grouping; mirrors Sales vs Purchasing). */
export const SECTION_ORDER: NavSection[] = [
  "Overview",
  "Catalogue",
  "Inventory",
  "Purchasing",
  "Sales",
  "Insights",
  "Workspace",
];

export interface NavItem {
  name: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  /** Visible if the user holds this permission (admins always pass). */
  permission?: string;
  /** Visible to Admin only. */
  adminOnly?: boolean;
}

/**
 * Phase 1 navigation. Later phases append their modules (Products, Inventory,
 * Sales, …) here — each gated by its permission so the sidebar reflects exactly
 * what the signed-in user can do (SOW §4 role-based experience).
 */
export const NAV_ITEMS: NavItem[] = [
  // ---- Overview ----
  {
    name: "Dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "Overview",
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  // ---- Catalogue ----
  {
    name: "Products",
    label: "Products",
    icon: Package,
    section: "Catalogue",
    permission: PERMISSIONS.PRODUCTS_VIEW,
  },
  {
    name: "MedGuide",
    label: "MedGuide",
    icon: BookOpen,
    section: "Catalogue",
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    name: "Search",
    label: "Search",
    icon: Search,
    section: "Catalogue",
    permission: PERMISSIONS.PRODUCT_SEARCH,
  },
  // ---- Inventory ----
  {
    name: "Inventory",
    label: "Inventory",
    icon: Boxes,
    section: "Inventory",
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  {
    name: "ShortBook",
    label: "ShortBook",
    icon: ListChecks,
    section: "Inventory",
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  {
    name: "Warehouse",
    label: "Warehouse",
    icon: Warehouse,
    section: "Inventory",
    permission: PERMISSIONS.WAREHOUSE_MANAGE,
  },
  {
    name: "Transfers",
    label: "Transfers",
    icon: ArrowLeftRight,
    section: "Inventory",
    permission: PERMISSIONS.STOCK_TRANSFER_MANAGE,
  },
  {
    name: "Expiry",
    label: "Expiry",
    icon: AlarmClock,
    section: "Inventory",
    permission: PERMISSIONS.EXPIRY_MANAGE,
  },
  {
    name: "Damaged",
    label: "Damaged",
    icon: ShieldAlert,
    section: "Inventory",
    permission: PERMISSIONS.DAMAGED_MANAGE,
  },
  // ---- Purchasing ----
  {
    name: "Receive",
    label: "Receive Stock",
    icon: PackagePlus,
    section: "Purchasing",
    permission: PERMISSIONS.STOCK_INWARD_MANAGE,
  },
  {
    name: "Orders",
    label: "Orders",
    icon: ShoppingBag,
    section: "Purchasing",
    permission: PERMISSIONS.PURCHASES_MANAGE,
  },
  {
    name: "Suppliers",
    label: "Suppliers",
    icon: Truck,
    section: "Purchasing",
    permission: PERMISSIONS.SUPPLIERS_MANAGE,
  },
  {
    name: "PDC",
    label: "Cheques / PDC",
    icon: CalendarClock,
    section: "Purchasing",
    permission: PERMISSIONS.SUPPLIERS_MANAGE,
  },
  // ---- Sales ----
  {
    name: "Sales",
    label: "Sales",
    icon: ShoppingCart,
    section: "Sales",
    permission: PERMISSIONS.SALES_MANAGE,
  },
  {
    name: "Customers",
    label: "Customers",
    icon: Contact,
    section: "Sales",
    permission: PERMISSIONS.CUSTOMERS_MANAGE,
  },
  // ---- Insights ----
  {
    name: "Reports",
    label: "Reports",
    icon: BarChart3,
    section: "Insights",
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    name: "AuditLog",
    label: "Audit Logs",
    icon: ScrollText,
    section: "Insights",
    permission: PERMISSIONS.AUDIT_VIEW,
  },
  // ---- Workspace ----
  {
    name: "Team",
    label: "Team & Access",
    icon: Users,
    section: "Workspace",
    adminOnly: true,
  },
  {
    name: "Settings",
    label: "Settings",
    icon: Settings,
    section: "Workspace",
    adminOnly: true,
  },
  {
    name: "Reminders",
    label: "Reminders",
    icon: BellRing,
    section: "Workspace",
  },
  { name: "Profile", label: "Profile", icon: UserRound, section: "Workspace" },
];

/**
 * The nav items this user may actually use.
 *
 * Single source of truth for both the Sidebar (what to draw) and the navigator
 * (which routes to register) — if they disagreed, a user could reach a section
 * the sidebar refuses to show. Server-side permission checks remain the real
 * guard; this just keeps the UI honest.
 */
export function useVisibleNavItems(): NavItem[] {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  return NAV_ITEMS.filter((it) => {
    if (it.adminOnly) return isAdmin();
    if (it.permission) return hasPermission(it.permission);
    return true;
  });
}
