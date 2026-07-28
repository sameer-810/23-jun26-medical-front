export interface AdminOverview {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  catalogProducts: number;
}

export interface AdminOrgOwner {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Subscription {
  planId: string | null;
  planCode: string;
  status: "trial" | "active" | "past_due" | "cancelled";
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

export interface AdminOrg {
  id: string;
  name: string;
  industry: string;
  isActive: boolean;
  status: "active" | "suspended";
  owner: AdminOrgOwner | null;
  stats: { users: number; products: number; sales: number };
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  drugLicenseNo?: string;
  subscription?: Subscription;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "admin" | "staff";
  roleLabel: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CatalogProduct {
  _id: string;
  sku: string;
  name: string;
  saltComposition: string;
  manufacturerName: string;
  mrp: number;
  prescriptionRequired: boolean;
  productForm: string;
  packLabel: string;
  medicineType: string;
  countryOfOrigin: string;
  hsnCode: string;
  images: string[];
  uses: string[];
  sideEffects: string[];
  substitutes: string[];
  drugClass?: {
    chemical: string;
    therapeutic: string;
    action: string;
    habitForming: string;
  };
  isActive: boolean;
  isDeleted?: boolean;
  source: string;
}

export interface CatalogStats {
  total: number;
  active: number;
  withImages: number;
  withClinical: number;
}

export interface Plan {
  _id: string;
  name: string;
  code: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxProducts: number;
  features: string[];
  isActive: boolean;
}

export interface PlatformAdminRow {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  _id: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  ip: string;
  createdAt: string;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreatePharmacyInput {
  organizationName: string;
  industry?: string;
  admin: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    password: string;
  };
}
