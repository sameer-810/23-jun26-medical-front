import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@modules/auth/api/authApi";
import { useAuthStore } from "@shared/store/useAuthStore";

/**
 * The devices this account is signed in on.
 *
 * The caller's own refresh token goes along so the server can flag which row is
 * "this device" — without it, someone freeing a slot can't tell which session
 * they're about to end.
 */
export function useSessions() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  return useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => authApi.sessions(refreshToken),
  });
}

/**
 * Signs out other devices. Defaults to keeping the current one: the button
 * exists to free a stuck slot, and logging the user out of the device they're
 * standing at would read as a bug.
 */
export function useLogoutAll() {
  const qc = useQueryClient();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  return useMutation({
    mutationFn: (keepCurrent: boolean = true) =>
      authApi.logoutAll(refreshToken, keepCurrent),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "sessions"] }),
  });
}
