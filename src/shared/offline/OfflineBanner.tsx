/**
 * App-wide connectivity strip. Absent while everything is normal; otherwise
 * one calm line that tells the pharmacist the till still works and what is
 * waiting. It must reassure, not alarm — "keep selling" is the message.
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { palette } from "@shared/designSystem";
import { openOfflineSync } from "@navigation/navigationRef";
import { useOfflineStore, useQueueCounts } from "./useOfflineStore";

const bills = (n: number) => (n === 1 ? "1 bill" : `${n} bills`);

/** "25 min" / "3 h" / "2 days" — roughly, for the staleness note. */
function age(iso: string, now: number): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/** The current minute, ticking — render-safe clock for the staleness note. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// A mirror older than this deserves a mention while selling against it.
const STALE_AFTER_MS = 30 * 60_000;
// A till clock this far from the server prints wrong times on legal bills.
const SKEW_WARN_MS = 10 * 60_000;

export function OfflineBanner() {
  const online = useOfflineStore((s) => s.online);
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt);
  const clockSkewMs = useOfflineStore((s) => s.clockSkewMs);
  const { pending, failed } = useQueueCounts();
  const now = useNow();

  let text: string | null = null;
  let tone: { bg: string; text: string; border: string } = palette.info;
  if (!online) {
    const stale =
      now > 0 &&
      lastSyncAt &&
      now - new Date(lastSyncAt).getTime() > STALE_AFTER_MS
        ? ` Stock and prices are ${age(lastSyncAt, now)} old.`
        : "";
    text =
      (pending > 0
        ? `Offline — billing continues. ${bills(pending)} will sync when the connection returns.`
        : "Offline — billing continues. Bills will sync when the connection returns.") +
      stale;
    tone = palette.warning;
  } else if (failed > 0) {
    text = `${bills(failed)} could not sync — open Sales to review.`;
    tone = palette.danger;
  } else if (pending > 0) {
    text = `Back online — syncing ${bills(pending)}…`;
  } else if (Math.abs(clockSkewMs) > SKEW_WARN_MS) {
    const mins = Math.round(Math.abs(clockSkewMs) / 60_000);
    text = `This device's clock is ~${mins} min ${clockSkewMs > 0 ? "ahead" : "behind"} — fix it so printed bills carry the right time.`;
    tone = palette.warning;
  }

  if (!text) return null;
  return (
    <Pressable
      onPress={openOfflineSync}
      accessibilityRole="button"
      accessibilityLabel="Open offline and sync"
      style={[
        styles.strip,
        { backgroundColor: tone.bg, borderBottomColor: tone.border },
      ]}
    >
      <Text style={[styles.text, { color: tone.text }]}>{text} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
