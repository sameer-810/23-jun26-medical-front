import { useMutation } from "@tanstack/react-query";
import { profileApi } from "@modules/profile/api/profileApi";
import { useAuthStore } from "@shared/store/useAuthStore";

export const useUpdateProfile = () => {
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: (patch: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }) => profileApi.updateMe(patch),
    onSuccess: (user) => updateUser(user),
  });
};

export const useDeleteAccount = () => {
  const logout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: (password: string) => profileApi.deleteAccount(password),
    // Every session is already gone on the server; clearing local state sends
    // the navigator back to sign-in.
    onSuccess: () => logout(),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      profileApi.changePassword(payload),
  });
