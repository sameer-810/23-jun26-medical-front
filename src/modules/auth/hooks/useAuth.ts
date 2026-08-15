import { useMutation } from "@tanstack/react-query";
import { authApi } from "@modules/auth/api/authApi";
import {
  AuthResponse,
  LoginPayload,
  SignupPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
} from "@modules/auth/types";
import { useAuthStore } from "@shared/store/useAuthStore";

const applyAuth = (res: AuthResponse) => {
  if (res.success && res.data) {
    const { user, organization, accessToken, refreshToken } = res.data;
    useAuthStore
      .getState()
      .setAuth(user, organization, accessToken, refreshToken);
  }
};

export const useLogin = () =>
  useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: applyAuth,
  });

/**
 * Registering no longer signs you in.
 *
 * `applyAuth` used to run here, storing whatever came back and dropping the
 * user straight into the dashboard. The workspace is now queued for approval
 * and the response carries no tokens, so applying it would have written a null
 * session over a real one. The screen reads `isSuccess` and shows the
 * "awaiting approval" state instead.
 */
export const useSignup = () =>
  useMutation({
    mutationFn: (payload: SignupPayload) => authApi.signup(payload),
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (payload: ForgotPasswordPayload) =>
      authApi.forgotPassword(payload),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (payload: ResetPasswordPayload) =>
      authApi.resetPassword(payload),
  });
