import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@modules/settings/api/settingsApi";
import { SettingsPatch } from "@modules/settings/types";

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.get() });

/**
 * Shop-setup completeness. Under the ["settings"] key so saving settings
 * re-checks it. Fails open: offline or erroring, the app is not locked.
 */
export const useSetupStatus = (enabled = true) =>
  useQuery({
    queryKey: ["settings", "setup-status"],
    queryFn: () => settingsApi.setupStatus(),
    enabled,
    staleTime: 5 * 60_000,
  });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => settingsApi.update(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
};

export const useEmailBackup = () =>
  useMutation({ mutationFn: () => settingsApi.emailBackup() });
