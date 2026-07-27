export interface AdminOverview {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
}

export interface AdminOrgOwner {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface AdminOrg {
  id: string;
  name: string;
  industry: string;
  isActive: boolean;
  status: "active" | "suspended";
  owner: AdminOrgOwner | null;
  stats: { users: number; products: number; sales: number };
  createdAt: string;
  updatedAt: string;
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
