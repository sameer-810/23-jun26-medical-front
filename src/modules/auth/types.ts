import { User, Organization } from "@shared/store/useAuthStore";

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    organization: Organization;
    accessToken: string;
    refreshToken: string;
  };
}

export interface MessageResponse {
  success: boolean;
  data: { message: string };
}

export interface LoginPayload {
  email: string;
  password: string;
  /** Ends the user's other sessions so this device can take a slot. */
  signOutOthers?: boolean;
}

export interface SignupPayload {
  organizationName: string;
  industry?: string;
  firstName: string;
  lastName?: string;
  email: string;
  /** Required now — sales rings this about the quotation. */
  phone: string;
  /** The owner's own address, distinct from the shop's shared login email. */
  personalEmail: string;
  password: string;
  /**
   * The plan card they clicked, arriving as `?plan=12m` on the signup URL.
   *
   * Not a purchase — nothing is charged at signup and the workspace still
   * starts on the free trial. It rides along so the quotation call opens with the
   * right number instead of "which one were you looking at?".
   */
  planCode?: string;
}

/** Signup starts the free trial and signs the owner straight in. */
export type SignupResponse = AuthResponse;

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  token: string;
  password: string;
}

/** One signed-in device. The refresh token itself is never sent to the client. */
export interface DeviceSession {
  id: string;
  deviceName: string;
  userAgent: string;
  ip: string;
  lastSeenAt: string;
  createdAt: string;
  /** True for the device making the request. */
  current: boolean;
}

export interface SessionList {
  /** Devices allowed at once — set per pharmacy by the platform admin. */
  limit: number;
  used: number;
  sessions: DeviceSession[];
}
