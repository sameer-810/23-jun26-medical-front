/**
 * useTheme — the colour set for the OS appearance the device is currently in.
 *
 * ---------------------------------------------------------------------------
 * STATUS: FOUNDATION ONLY. Dark mode is NOT switched on yet.
 * ---------------------------------------------------------------------------
 *
 * `app.json` still pins `userInterfaceStyle: "light"`, so `useColorScheme()`
 * always reports light and this hook always returns the light set. Flipping it
 * to "automatic" is a one-line change — but do not make that change until the
 * migration below is finished, because a half-migrated app in dark mode is
 * strictly worse than a light-only one: you get white cards punched into a dark
 * page, which is harder to read than either theme done properly.
 *
 * WHY THE MIGRATION IS NOT TRIVIAL
 *
 * The app has 622 `palette.*` references across 93 files, and 51 of those files
 * declare `StyleSheet.create({...})` at MODULE SCOPE with palette values baked
 * in. Module scope runs once, at import, before any component mounts — so those
 * styles physically cannot observe a theme change. No provider, context or
 * proxy fixes that; the styles have to move inside the component.
 *
 * THE MIGRATION, per file:
 *
 *   // before — evaluated once at import, frozen to the light palette
 *   const styles = StyleSheet.create({
 *     row: { backgroundColor: palette.surface.primary },
 *   });
 *
 *   // after — re-evaluated whenever the scheme changes
 *   const useStyles = makeStyles((t) => ({
 *     row: { backgroundColor: t.surface.primary },
 *   }));
 *   // ...then inside the component:
 *   const styles = useStyles();
 *
 * Order to do it in: `shared/ui/*` first (28 files, and they carry most of the
 * app's surface area), then the screens by traffic. Only once every file that
 * paints a background or a text colour is converted should `app.json` change.
 *
 * Until then this hook is safe to adopt in new code — it returns exactly the
 * light values the static `palette` export already returns.
 */
import { useMemo } from "react";
import { useColorScheme, StyleSheet } from "react-native";
import {
  palette,
  darkPalette,
  accents,
  darkAccents,
  shadows,
} from "./designSystem";

export type ColorScheme = "light" | "dark";

/**
 * The token groups are declared by SHAPE, not by `typeof palette.x`.
 *
 * Both palettes are `as const`, so their properties type as literals
 * ("#FFFFFF", not string) and the light and dark sets refuse to unify. Naming
 * the shape keeps the keys checked while letting either scheme satisfy it.
 */
type Ramp = Record<
  50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900,
  string
>;
type Surfaces = Record<
  | "primary"
  | "secondary"
  | "tertiary"
  | "raised"
  | "sunken"
  | "dark"
  | "darkRaised",
  string
>;
type Inks = Record<
  | "primary"
  | "secondary"
  | "tertiary"
  | "disabled"
  | "inverse"
  | "accent"
  | "link",
  string
>;
type Borders = Record<
  "subtle" | "default" | "strong" | "focus" | "dark",
  string
>;
type Semantic = { bg: string; text: string; border: string };
type AccentPair = { color: string; tint: string };

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  surface: Surfaces;
  text: Inks;
  border: Borders;
  ink: Ramp;
  success: Semantic;
  warning: Semantic;
  danger: Semantic;
  info: Semantic;
  /** The brand ramp is identical in both schemes — it is the logo. */
  brand: Ramp;
  accents: Record<keyof typeof accents, AccentPair>;
  /**
   * Elevation. Shadow does almost nothing on a dark ground — depth there comes
   * from a lighter surface, not a darker shadow — so dark returns no-ops and
   * relies on `surface.raised` instead.
   */
  shadows: Record<keyof typeof shadows, object>;
}

function build(scheme: ColorScheme): Theme {
  const dark = scheme === "dark";
  const p = dark ? darkPalette : palette;
  return {
    scheme,
    isDark: dark,
    surface: p.surface,
    text: p.text,
    border: p.border,
    ink: dark ? darkPalette.ink : palette.ink,
    success: p.success,
    warning: p.warning,
    danger: p.danger,
    info: p.info,
    brand: palette.teal,
    accents: dark ? darkAccents : accents,
    shadows: dark
      ? { ...shadows, xs: {}, sm: {}, md: {}, lg: {}, xl: {} }
      : shadows,
  };
}

const LIGHT = build("light");
const DARK = build("dark");

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}

/**
 * Theme-aware replacement for a module-scope `StyleSheet.create`.
 *
 * Returns a hook. The sheet is rebuilt only when the scheme actually changes,
 * so this costs one memo per component rather than a sheet per render.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
) {
  const cache = new Map<ColorScheme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => {
      const hit = cache.get(theme.scheme);
      if (hit) return hit;
      const sheet = StyleSheet.create(factory(theme));
      cache.set(theme.scheme, sheet);
      return sheet;
    }, [theme]);
  };
}
