/**
 * useBreakpoint — one responsive hook so screens stop hardcoding pixel widths.
 * `atLeast('lg')` / `below('md')` read against the shared `breakpoints` tokens.
 */
import { useWindowDimensions } from "react-native";
import { breakpoints, layout } from "../designSystem";

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

/**
 * The height of a text input, select or combobox on this layout.
 *
 * Same reasoning as the two button ladders: a pointer wants a 38px field and a
 * thumb wants 46. Every control was pinned at 50px, which on a form of six
 * fields adds ~70px of nothing and is most of why the forms read as loose.
 */
export function useControlHeight() {
  const { width } = useWindowDimensions();
  return width >= breakpoints.lg
    ? layout.controlHeight
    : layout.controlHeightPhone;
}
