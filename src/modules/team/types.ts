export interface TeamUser {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  role: "admin" | "staff";
  roleLabel: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
  roleLabel?: string;
  permissions?: string[];
}

/** What PATCH /users/:id accepts — contact details only; privileges have their own endpoints. */
export interface UpdateMemberPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface PermissionCatalogue {
  permissions: string[];
  suggestedLabels: string[];
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}

/**
 * The two limits a pharmacy controls, and what its plan allows.
 *
 * Deliberately separate numbers: how many staff accounts exist is a different
 * commercial question from how many screens one of them may be signed in on.
 * A ceiling of 0 means the plan sets none, so the admin may choose freely.
 */
export interface TeamLimits {
  users: { current: number; ceiling: number };
  devices: { current: number; ceiling: number };
  usersInUse: number;
}
