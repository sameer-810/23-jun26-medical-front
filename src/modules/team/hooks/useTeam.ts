import {
  useMutation,
  useQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import { teamApi } from "@modules/team/api/teamApi";
import { CreateUserPayload } from "@modules/team/types";

export const useTeamUsers = (params?: { search?: string; role?: string }) =>
  useQuery({
    queryKey: ["team-users", params],
    queryFn: () => teamApi.list(params),
  });

export const useTeamUser = (id: string) =>
  useQuery({
    queryKey: ["team-user", id],
    queryFn: () => teamApi.get(id),
    enabled: !!id,
  });

export const usePermissionCatalogue = () =>
  useQuery({
    queryKey: ["permission-catalogue"],
    queryFn: () => teamApi.permissionCatalogue(),
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => teamApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-users"] }),
  });
};

export const useUpdatePermissions = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { roleLabel?: string; permissions?: string[] }) =>
      teamApi.updatePermissions(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-users"] });
      qc.invalidateQueries({ queryKey: ["team-user", id] });
    },
  });
};

export const useSetActive = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => teamApi.setActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-users"] });
      qc.invalidateQueries({ queryKey: ["team-user", id] });
    },
  });
};

export const useResetUserPassword = (id: string) =>
  useMutation({
    mutationFn: (newPassword: string) => teamApi.resetPassword(id, newPassword),
  });

export const useRemoveUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-users"] }),
  });
};

/** Paged audit trail — append-only, so it grows continuously. */
export const useAuditLogs = (params?: {
  search?: string;
  action?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => teamApi.auditLogs(params),
    placeholderData: keepPreviousData,
  });

/** Seat and device limits for this pharmacy, with the plan's ceiling. */
export const useTeamLimits = () =>
  useQuery({ queryKey: ["team-limits"], queryFn: teamApi.limits });

export const useUpdateTeamLimits = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { maxUsers?: number; maxDevicesPerUser?: number }) =>
      teamApi.updateLimits(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-limits"] }),
  });
};
