/**
 * Telling a barcode gun from a person, by speed alone.
 *
 * A USB scanner is a keyboard, so the only tell is timing: it emits characters
 * a few milliseconds apart, which no hand can. Times are event timestamps, not
 * the moment a handler ran, so a busy render can't make a scan look human.
 */

/** Max gap between keystrokes still considered one scanner burst. */
export const BURST_GAP_MS = 50;
/** Quiet period after which a burst is treated as finished (no Enter suffix). */
export const FLUSH_MS = 120;
/** Shorter than this is almost certainly a human, not a scan. */
export const MIN_CODE_LEN = 6;

export class BurstTracker {
  buffer = "";
  private lastAt = 0;

  /** Records a printable key. True when it starts a new run. */
  char(ch: string, at: number): boolean {
    const fresh = !this.buffer || at - this.lastAt > BURST_GAP_MS;
    if (fresh) this.buffer = "";
    this.buffer += ch;
    this.lastAt = at;
    return fresh;
  }

  /** Is an Enter at `at` the tail of a scan? */
  isScan(at: number): boolean {
    return (
      this.buffer.length >= MIN_CODE_LEN && at - this.lastAt <= BURST_GAP_MS
    );
  }

  reset() {
    this.buffer = "";
  }
}
