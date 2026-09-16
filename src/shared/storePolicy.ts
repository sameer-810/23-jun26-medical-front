import { Platform } from "react-native";

/**
 * Whether this build may show prices or ask anyone to buy anything.
 *
 * Plusveda is sold on the website (plusveda.app, ₹250/month) and the workspace
 * is activated by the platform team. On iOS that is allowed only as a "free
 * stand-alone companion to a paid web based tool" — App Store guideline
 * 3.1.3(f) — and only while the app itself contains no purchasing and no call
 * to action to buy outside it. Anything priced (plans, the quotation promise,
 * paid email/SMS alerts) must therefore stay off iOS, or the app has to sell
 * through Apple's in-app purchase instead.
 *
 * Android and web are unaffected.
 */
export const SHOW_PRICES = Platform.OS !== "ios";
