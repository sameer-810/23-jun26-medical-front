/**
 * Free-trial countdown, shown above the app while a self-service trial runs.
 * Turns amber in the last two days so the end never comes as a surprise —
 * once it passes, sign-in is refused until a plan is activated.
 */
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@shared/api/apiClient";
import { palette } from "@shared/designSystem";
import { useAuthStore } from "@shared/store/useAuthStore";
import { openPlans } from "@navigation/navigationRef";
import { SHOW_PRICES } from "@shared/storePolicy";

const DAY_MS = 86_400_000;

/** Whole days left, counting today: ends tonight = 1 day left. */
export function trialDaysLeft(trialEndsAt: string, now = Date.now()): number {
  return Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - now) / DAY_MS),
  );
}

export function TrialBanner() {
  const trialEndsAt = useAuthStore((s) => s.organization?.trialEndsAt);
  /* The store only learns the trial date at sign-in. Re-read it hourly while
     a trial runs, so the strip goes away once the platform team activates a
     plan, without signing out. */
  useQuery({
    queryKey: ["organization", "me", "trial"],
    enabled: Boolean(trialEndsAt),
    refetchInterval: 60 * 60_000,
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { trialEndsAt?: string | null };
      }>("/organization/me");
      useAuthStore
        .getState()
        .updateOrganization({ trialEndsAt: res.data.data.trialEndsAt ?? null });
      return res.data.data;
    },
  });
  if (!trialEndsAt) return null;

  const left = trialDaysLeft(trialEndsAt);
  const tone = left <= 2 ? palette.warning : palette.info;
  const when = left <= 1 ? "ends today" : `${left} days left`;
  const text = `Free trial — ${when}. Choose a plan to keep using Plusveda after it ends.`;

  const strip = [
    styles.strip,
    { backgroundColor: tone.bg, borderBottomColor: tone.border },
  ];
  // iOS has no price list (storePolicy.ts), so the strip only informs there.
  if (!SHOW_PRICES)
    return (
      <Text style={[strip, styles.text, { color: tone.text }]}>{text}</Text>
    );
  return (
    <Pressable
      onPress={openPlans}
      accessibilityRole="button"
      accessibilityLabel="See plans"
      style={strip}
    >
      <Text style={[styles.text, { color: tone.text }]}>
        {text} See plans ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    textAlign: "center",
  },
  text: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
