import React, { useCallback, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConfirmDialog } from "@shared/ui";

const CONSENT_KEY = "aiScanConsent.v1";

async function hasConsent(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(CONSENT_KEY) === "1";
    return (await AsyncStorage.getItem(CONSENT_KEY)) === "1";
  } catch {
    return false;
  }
}

function saveConsent() {
  try {
    if (Platform.OS === "web") localStorage.setItem(CONSENT_KEY, "1");
    else void AsyncStorage.setItem(CONSENT_KEY, "1").catch(() => {});
  } catch {
    // Private-mode browsers throw on localStorage; they will simply be asked again.
  }
}

/**
 * Asks once, per device, before a photo is sent to Google Gemini to be read.
 *
 * Bill, pack and cheque scans all go to the server's /ocr endpoints, which pass
 * the image to Gemini. A cheque carries a name and bank details, so App Store
 * guideline 5.1.2(i) applies: people must be told when personal data goes to a
 * third-party AI service, and agree first.
 *
 * Ask BEFORE opening the camera, never from inside a scanner: the pack scanner
 * is itself a Modal, and iOS will not present a second Modal over it.
 *
 * Render `dialog` once in the screen; `await ensure()` resolves true when the
 * scan may go ahead.
 */
export function useAiScanConsent() {
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(
    null,
  );

  const ensure = useCallback(async () => {
    if (await hasConsent()) return true;
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const answer = (ok: boolean) => {
    if (ok) saveConsent();
    resolver?.(ok);
    setResolver(null);
  };

  const dialog = (
    <ConfirmDialog
      visible={resolver !== null}
      title="Read this photo with AI?"
      message="To read the printed text on bills, medicine packs and cheques, Plusveda sends the photo to Google Gemini, an AI service run by Google. A photo can include names, addresses and bank details. Plusveda sends it only to read the text for you; see our privacy policy for details. If you choose Not now, you can still type the details in."
      confirmLabel="Allow"
      cancelLabel="Not now"
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );

  return { ensure, dialog };
}
