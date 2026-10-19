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

/** Registering starts the free trial and signs the owner in at once. */
export const useSignup = () =>
  useMutation({
    mutationFn: (payload: SignupPayload) => authApi.signup(payload),
    onSuccess: applyAuth,
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
