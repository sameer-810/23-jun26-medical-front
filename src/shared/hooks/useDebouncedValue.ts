import { useEffect, useState } from "react";

/**
 * The value, `delay` ms after it stopped changing.
 *
 * Put the RESULT in a query key, never the raw keystroke state: one request per
 * pause instead of one per letter, and replies can't land out of order and
 * leave a list that doesn't match the box.
 *
 * While the two differ the results on screen belong to an older query — feed
 * `search !== debouncedSearch` into the spinner so the gap doesn't read as
 * "nothing found".
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
