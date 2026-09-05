export interface AdminOverview {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  catalogProducts: number;
  /** Registrations waiting on a quotation — somebody is locked out until 0. */
  pendingOrgs?: number;
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

/**
 * Per-pharmacy controls. `deviceLimit` is the number actually in force;
 * `deviceLimitSource` says whether it came from this pharmacy, its plan, or the
 * platform default, so an operator can tell an inherited limit from a
 * deliberate override. The Gemini key is only ever a mask — the real value
 * stays on the server.
 */
export interface AdminOrgSettings {
  deviceLimit: number;
  deviceLimitSource: "pharmacy" | "plan" | "platform";
  deviceLimitOverride: number;
  /** Staff seats. 0 = no limit anywhere, which is genuinely unlimited. */
  userLimit: number;
  userLimitSource: "pharmacy" | "plan" | "unlimited";
  userLimitOverride: number;
  geminiConfigured: boolean;
  geminiKeyMasked: string;
  geminiModel: string;
}

export interface AdminOrg {
  id: string;
  name: string;
  industry: string;
  isActive: boolean;
  status: "active" | "suspended";
  /**
   * The onboarding gate, separate from `status` above.
   *
   * A pharmacy can be `isActive` and still `pending` — registered but never
   * approved, and therefore unable to log in. The console must not read one
   * from the other.
   */
  approvalStatus: "pending" | "approved" | "rejected";
  approvalRequestedAt: string | null;
  approvalDecidedAt: string | null;
  approvalDecidedBy: string;
  approvalNote: string;
  /** Who to ring about the quotation, as opposed to the shop's own details. */
  contactPersonalEmail: string;
  contactPhone: string;
  owner: AdminOrgOwner | null;
  stats: { users: number; products: number; sales: number };
  settings?: AdminOrgSettings | null;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  drugLicenseNo?: string;
  subscription?: Subscription;
  createdAt: string;
  updatedAt: string;
}

/** What the edit form may send. Omitted keys are left untouched server-side. */
export interface UpdatePharmacyInput {
  name?: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  drugLicenseNo?: string;
  /** 0 clears the override and falls back to the plan / platform default. */
  maxDevicesPerUser?: number;
  /** 0 clears the override and falls back to the plan's seat quota. */
  maxUsers?: number;
  /** "" removes this pharmacy's key so it uses the platform key. */
  geminiApiKey?: string;
  geminiModel?: string;
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
  /** Pack hierarchy consumed by product.service.createFromCatalog. */
  packUnit: string;
  packQty: number;
  baseUnit: string;
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
  /** The headline rate the card leads with — ₹225 on the 12-month plan. */
  priceMonthly: number;
  /** Legacy, predates termMonths/priceTotal. Nothing reads it. */
  priceYearly: number;

  /* How the plan is sold: a term, and one payment for it. */
  termMonths: number;
  /** Rupees, paid once, for the whole term. The number that is charged. */
  priceTotal: number;
  /** Struck-through "Instead of". 0 = derive from the 1-month plan. */
  referencePrice: number;
  /** e.g. "Save 78%". Blank = derive it from the discount. */
  badge: string;
  /** The one line under the plan name on the card. */
  tagline: string;
  /** The single raised "Best value" card. Promoting one demotes the rest. */
  isFeatured: boolean;
  sortOrder: number;

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
  /** Statutory identifiers — GSTIN prints on invoices, DL is a legal must. */
  gstin?: string;
  drugLicenseNo?: string;
  admin: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    password: string;
  };
}

/** One signed-in device inside a pharmacy, as the platform console sees it. */
export interface OrgDeviceSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  deviceName: string;
  userAgent: string;
  ip: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface OrgSessions {
  pharmacy: { id: string; name: string };
  deviceLimit: number;
  deviceLimitSource: "pharmacy" | "plan" | "platform";
  totalSessions: number;
  sessions: OrgDeviceSession[];
  /** Staff over the current limit — a limit change doesn't evict anyone. */
  overLimit: { userId: string; name: string; count: number }[];
}
