import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { BurstTracker, FLUSH_MS, MIN_CODE_LEN } from "./scanBurst";

/**
 * Listens for a USB barcode scanner anywhere on the screen.
 *
 * A USB scanner is a keyboard: it "types" the code and usually presses Enter.
 * That means it only reaches an input that happens to have FOCUS — so if the
 * cashier clicked anything else first, a scan silently goes nowhere. That is the
 * single most common reason a scanner "doesn't work".
 *
 * So we watch the whole document instead and tell a scanner apart from a human
 * by SPEED: a scanner emits characters a few milliseconds apart, a person can't.
 * Slow typing never accumulates, so normal use of the other fields is untouched.
 *
 * Also handles scanners configured WITHOUT an Enter suffix, by flushing the
 * buffer once the burst goes quiet.
 */

type TextBox = HTMLInputElement | HTMLTextAreaElement;

const isTextBox = (el: EventTarget | null): el is TextBox =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

/**
 * Puts back what a scan typed over. Through the native setter plus an input
 * event, so React's controlled value moves with it; setting `.value` alone would
 * be reverted on the next render.
 */
function restoreValue(el: TextBox, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function useScanGun(
  onScan: (code: string) => void,
  options: { enabled?: boolean; ignoreSelector?: string } = {},
) {
  const { enabled = true, ignoreSelector } = options;
  // Hold the latest callback so the document listener never needs re-binding.
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const burst = new BurstTracker();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The field the burst began in and what it held before the first character.
    let field: TextBox | null = null;
    let prior = "";

    const flush = () => {
      const code = burst.buffer.trim();
      burst.reset();
      if (code.length < MIN_CODE_LEN) return;
      if (field) restoreValue(field, prior);
      cb.current(code);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // The visible scan box handles its own Enter — don't process it twice.
      const target = e.target as HTMLElement | null;
      if (
        ignoreSelector &&
        target?.closest &&
        target.closest(ignoreSelector) !== null
      ) {
        return;
      }

      if (timer) clearTimeout(timer);

      if (e.key === "Enter") {
        if (burst.isScan(e.timeStamp)) {
          // Swallow the Enter so it can't also submit some other form.
          e.preventDefault();
          e.stopPropagation();
          flush();
        } else {
          burst.reset();
        }
        return;
      }

      // Printable characters only — modifiers/arrows aren't part of a code.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Capture phase: this runs before the character reaches the field.
        if (burst.char(e.key, e.timeStamp)) {
          field = isTextBox(target) ? target : null;
          prior = field?.value ?? "";
        }
        timer = setTimeout(flush, FLUSH_MS);
      }
    };

    // Capture phase: we see the keys before any field consumes them.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, ignoreSelector]);
}
