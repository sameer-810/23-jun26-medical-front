import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@modules/settings/api/settingsApi";
import { SettingsPatch } from "@modules/settings/types";

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.get() });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => settingsApi.update(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
};

export const useEmailBackup = () =>
  useMutation({ mutationFn: () => settingsApi.emailBackup() });
