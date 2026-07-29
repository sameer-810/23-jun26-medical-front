/**
 * WhatsApp click-to-chat (wa.me) — opens WhatsApp with a pre-filled message to a
 * customer's number. No paid WhatsApp Business API required; works on native and
 * on web (WhatsApp Web / desktop). This is the free-tier pattern eVitalRx /
 * Vyapar / myBillBook use for invoice + reminder sharing.
 */
import { Linking } from "react-native";

/** Normalise an Indian mobile to wa.me digits (prepend 91 for bare 10-digit). */
function toWaNumber(mobile: string): string {
  const d = (mobile || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

/** Build a wa.me URL (no number ⇒ WhatsApp lets the user pick a contact). */
export function whatsappUrl(mobile: string | null | undefined, text: string) {
  const num = mobile ? toWaNumber(mobile) : "";
  const q = `?text=${encodeURIComponent(text)}`;
  return num ? `https://wa.me/${num}${q}` : `https://wa.me/${q}`;
}

/** Open WhatsApp with the pre-filled message. Returns false if it couldn't open. */
export async function sendWhatsApp(
  mobile: string | null | undefined,
  text: string,
): Promise<boolean> {
  try {
    await Linking.openURL(whatsappUrl(mobile, text));
    return true;
  } catch {
    return false;
  }
}
