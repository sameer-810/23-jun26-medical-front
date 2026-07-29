/**
 * useBreakpoint — one responsive hook so screens stop hardcoding pixel widths.
 * `atLeast('lg')` / `below('md')` read against the shared `breakpoints` tokens.
 */
import { useWindowDimensions } from "react-native";
import { breakpoints } from "../designSystem";

type Bp = keyof typeof breakpoints;

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    width,
    /** The desktop sidebar shell threshold (≥ lg). */
    isWide: width >= breakpoints.lg,
    isPhone: width < breakpoints.lg,
    atLeast: (bp: Bp) => width >= breakpoints[bp],
    below: (bp: Bp) => width < breakpoints[bp],
  };
}
