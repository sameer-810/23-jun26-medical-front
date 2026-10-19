/**
 * Frontend mirror of the backend permission catalogue (config/roles.js). Keys
 * MUST match the server exactly — the server is the source of truth and enforces
 * every gate; this map only drives the UI (nav visibility, permission editor).
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  MANAGE_USERS: "users.manage",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_MANAGE: "products.manage",
  WAREHOUSE_MANAGE: "warehouse.manage",
  STOCK_INWARD_MANAGE: "stock_inward.manage",
  INVENTORY_VIEW: "inventory.view",
  PRODUCT_SEARCH: "product_search.view",
  STOCK_TRANSFER_MANAGE: "stock_transfer.manage",
  SALES_MANAGE: "sales.manage",
  EXPIRY_MANAGE: "expiry.manage",
  DAMAGED_MANAGE: "damaged.manage",
  CUSTOMERS_MANAGE: "customers.manage",
  SUPPLIERS_MANAGE: "suppliers.manage",
  PURCHASES_MANAGE: "purchases.manage",
  REPORTS_VIEW: "reports.view",
  AUDIT_VIEW: "audit.view",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Human labels + grouping for the permission editor (SOW §6). */
export const PERMISSION_META: Record<
  string,
  { label: string; group: string; description: string }
> = {
  "dashboard.view": {
    label: "Dashboard",
    group: "Overview",
    description: "View the dashboard",
  },
  "products.view": {
    label: "View Products",
    group: "Catalogue",
    description: "Read the product catalogue",
  },
  "products.manage": {
    label: "Manage Products",
    group: "Catalogue",
    description: "Create, edit, deactivate products",
  },
  "warehouse.manage": {
    label: "Warehouse Setup",
    group: "Catalogue",
    description: "Manage warehouse locations",
  },
  "stock_inward.manage": {
    label: "Stock Inward",
    group: "Inventory",
    description: "Purchase entry — receive goods into stock",
  },
  "inventory.view": {
    label: "Inventory View",
    group: "Inventory",
    description: "View current/available stock",
  },
  "product_search.view": {
    label: "Product Search",
    group: "Inventory",
    description: "Search products & stock",
  },
  "stock_transfer.manage": {
    label: "Stock Transfer",
    group: "Inventory",
    description: "Transfer stock between locations",
  },
  "sales.manage": {
    label: "Sales",
    group: "Operations",
    description: "Create sales, invoices & returns",
  },
  "expiry.manage": {
    label: "Expiry Management",
    group: "Operations",
    description: "Manage expiry alerts",
  },
  "damaged.manage": {
    label: "Damaged Inventory",
    group: "Operations",
    description: "Record damaged/lost stock",
  },
  "customers.manage": {
    label: "Customers",
    group: "Partners",
    description: "Manage customers",
  },
  "suppliers.manage": {
    label: "Suppliers",
    group: "Partners",
    description: "Manage suppliers",
  },
  "purchases.manage": {
    label: "Purchases",
    group: "Partners",
    description: "Record purchases",
  },
  "reports.view": {
    label: "Reports",
    group: "Insights",
    description: "View & export reports",
  },
  "audit.view": {
    label: "Audit Logs",
    group: "Insights",
    description: "Read the audit trail",
  },
  "users.manage": {
    label: "User Management",
    group: "Admin",
    description: "Admin-only",
  },
  "settings.manage": {
    label: "Settings",
    group: "Admin",
    description: "Admin-only",
  },
};
