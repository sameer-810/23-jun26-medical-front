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
  /**
   * Registered as a route — deep links, ⌘K and in-app buttons all still reach
   * it — but given no sidebar row.
   *
   * A nav slot is for a place you go and work. These two are lookups you do
   * *while* working: MedGuide answers a question about a medicine (opened from
   * Products, the way Marg opens PharmaNXT from a button while billing), and
   * batch/expiry is a question about stock you're already looking at (opened
   * from Inventory). Neither is a destination, so neither earns a slot.
   */
  hidden?: boolean;
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
    hidden: true, // opened from the Products header
  },
  {
    name: "Search",
    label: "Batch & expiry search",
    icon: Search,
    section: "Catalogue",
    permission: PERMISSIONS.PRODUCT_SEARCH,
    hidden: true, // opened from the Inventory header
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

/**
 * What the Sidebar draws — permitted AND not `hidden`.
 *
 * Deliberately narrower than useVisibleNavItems(): the navigator must keep
 * registering hidden routes, or the buttons and ⌘K entries that open them would
 * dead-end.
 */
export function useSidebarNavItems(): NavItem[] {
  return useVisibleNavItems().filter((it) => !it.hidden);
}

/**
 * The screens the navigation itself lands on — a destination, not somewhere you
 * were sent. `Screen` reads this to decide whether to offer a way back: if you
 * are on one of these you arrived by choosing it, and there is nothing behind
 * you; anything else was opened on top of something and must offer a way out.
 *
 * Most NAV_ITEMS are a single screen, so their name is the landing screen. The
 * ones wrapping a stack land on the inner screen listed here — which is the one
 * mapped to the section's bare path in App.tsx's `linking`, NOT necessarily the
 * first `<Stack.Screen>` declared (Sales, for one, declares NewSale first).
 *
 * Kept beside NAV_ITEMS on purpose: a new section is added in both places at
 * once, and a name missing from here fails safe — the screen shows a back link
 * it does not strictly need, rather than trapping someone on it.
 */
export const LANDING_SCREENS = new Set<string>([
  ...NAV_ITEMS.map((it) => it.name),
  // Sections whose nav item is a stack: the screen its bare path resolves to.
  "ProductsList",
  "InventoryList",
  "MedGuideSearch",
  "OrdersList",
  "ReceiveStock",
  "NewSale",
  "CustomersList",
  "SuppliersList",
  "TeamList",
]);
