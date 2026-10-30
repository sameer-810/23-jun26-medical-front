/**
 * Offers a refresh once a newer build is live. Never reloads by itself: the
 * tab may be holding a half-made bill, so the pharmacist picks the moment.
 */
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { palette } from "@shared/designSystem";
import { isNewBuild, runningHash, servedHash } from "@shared/appUpdate";

const CHECK_EVERY_MS = 5 * 60_000;

export function UpdateBanner() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const running = runningHash();
    if (!running) return;
    const check = async () => {
      if (isNewBuild(running, await servedHash())) setOutdated(true);
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  if (!outdated) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => window.location.reload()}
      style={styles.strip}
    >
      <Text style={styles.text}>
        A new version of Plusveda is ready. Finish this bill, then tap here to
        refresh.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: palette.info.bg,
    borderBottomColor: palette.info.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { color: palette.info.text, fontSize: 13, textAlign: "center" },
});
