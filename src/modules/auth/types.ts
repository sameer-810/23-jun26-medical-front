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
}

export interface SignupPayload {
  organizationName: string;
  industry?: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
}

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
