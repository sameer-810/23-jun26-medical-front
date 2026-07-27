/**
 * Plusveda Design System — ServRx-aligned (2026).
 *
 * Bright clinical teal as the single confident brand colour, cobalt blue as the
 * secondary accent, on clean cool-white surfaces (never warm/greige). Friendly
 * rounded headings (Poppins) + highly legible data type (Inter). Modelled on the
 * ServRx pharmacy portal: colour-coded KPI cards, tinted summary bars, teal tab
 * underlines and active states, soft shadows over hairline borders.
 *
 * Token *structure* is unchanged from the previous system, so every screen and
 * the shared/ui kit re-skin from these values alone.
 */

export const palette = {
  // Ink — cool slate for calm, high-legibility text
  ink: {
    900: "#17242D",
    800: "#1E2C36",
    700: "#334049",
    600: "#4A5760",
    500: "#697680",
    400: "#94A2AB",
    300: "#C6CFD5",
    200: "#E1E7EB",
    100: "#EFF3F5",
    50: "#F6F9FB",
  },

  // Primary brand — bright clinical teal (ServRx)
  teal: {
    900: "#0A4F49",
    800: "#0C6E64",
    700: "#0E8C7F",
    600: "#16B2A2",
    500: "#22C3B2",
    400: "#43D0C1",
    300: "#7CE0D4",
    200: "#AEEBE3",
    100: "#D7F5F0",
    50: "#EDFBF9",
  },

  // Accent — cobalt blue (links, secondary CTAs, info, "sales")
  cobalt: {
    900: "#0E3F6E",
    800: "#125C9C",
    700: "#1673C0",
    600: "#1E8FE6",
    500: "#3B9AEA",
    400: "#5FAAEF",
    300: "#93C6F4",
    200: "#BFDDF8",
    100: "#DCEBFC",
    50: "#EFF6FE",
  },

  // Cool neutral surfaces
  neutral: {
    0: "#FFFFFF",
    50: "#F6F9FB",
    100: "#EFF3F5",
    200: "#E1E7EB",
    300: "#C6CFD5",
    400: "#94A2AB",
    500: "#697680",
    600: "#4A5760",
    700: "#334049",
    800: "#1E2C36",
    900: "#17242D",
  },

  surface: {
    primary: "#FFFFFF",
    secondary: "#F3F6F8",
    tertiary: "#EDF2F4",
    raised: "#FFFFFF",
    sunken: "#E9EFF2",
    dark: "#122029",
    darkRaised: "#1B2C36",
  },

  text: {
    primary: "#17242D",
    secondary: "#425059",
    tertiary: "#788690",
    disabled: "#A9B4BC",
    inverse: "#FFFFFF",
    accent: "#0E8C7F",
    link: "#1E8FE6",
  },

  border: {
    subtle: "#EFF3F5",
    default: "#E4EAEE",
    strong: "#D5DDE2",
    focus: "#16B2A2",
    dark: "#2A3A44",
  },

  // Semantic — stock / expiry / billing states
  success: { bg: "#E4F5EE", text: "#17976A", border: "#B7E6D3" },
  warning: { bg: "#FBF1DC", text: "#B6791A", border: "#F3DCA6" },
  danger: { bg: "#FCEAE7", text: "#D6412F", border: "#F6C9C1" },
  info: { bg: "#E7F1FC", text: "#1E7FD6", border: "#BFDDF8" },
} as const;

/**
 * KPI accent set — the ServRx colour-coded metric cards. Each entry is a
 * { color, tint } pair for a card's top border + soft icon background.
 */
export const accents = {
  teal: { color: "#16B2A2", tint: "#E4F6F3" },
  blue: { color: "#1E8FE6", tint: "#E7F1FC" },
  amber: { color: "#C1801C", tint: "#FBF1DC" },
  red: { color: "#DB4B3D", tint: "#FCEAE7" },
  purple: { color: "#7C6FE0", tint: "#EEECFB" },
} as const;

export const spacing = {
  "0": 0,
  px: 1,
  "0.5": 2,
  "1": 4,
  "1.5": 6,
  "2": 8,
  "2.5": 10,
  "3": 12,
  "3.5": 14,
  "4": 16,
  "5": 20,
  "6": 24,
  "7": 28,
  "8": 32,
  "9": 36,
  "10": 40,
  "12": 48,
  "14": 56,
  "16": 64,
  "20": 80,
} as const;

// Soft, rounded corners for the clean clinical language.
export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  "2xl": 22,
  "3xl": 28,
  full: 9999,
} as const;

// Thin hairline outline.
export const outline = { width: 1, color: "#E4EAEE" } as const;

/**
 * Bundled font families (loaded via expo-font in App.tsx). Poppins carries the
 * friendly rounded headings; Inter carries body copy and all tabular data.
 * If a family fails to load the platform falls back to the system sans — no crash.
 */
export const fonts = {
  display: "Poppins_700Bold",
  heading: "Poppins_600SemiBold",
  bodyRegular: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const typography = {
  display: {
    large: {
      fontFamily: fonts.display,
      fontSize: 38,
      lineHeight: 46,
      fontWeight: "700" as const,
      letterSpacing: -0.5,
    },
    medium: {
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 38,
      fontWeight: "700" as const,
      letterSpacing: -0.4,
    },
    small: {
      fontFamily: fonts.display,
      fontSize: 26,
      lineHeight: 34,
      fontWeight: "700" as const,
      letterSpacing: -0.3,
    },
  },
  heading: {
    h1: {
      fontFamily: fonts.display,
      fontSize: 23,
      lineHeight: 30,
      fontWeight: "700" as const,
      letterSpacing: -0.4,
    },
    h2: {
      fontFamily: fonts.heading,
      fontSize: 19,
      lineHeight: 26,
      fontWeight: "600" as const,
      letterSpacing: -0.3,
    },
    h3: {
      fontFamily: fonts.heading,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "600" as const,
      letterSpacing: -0.2,
    },
    h4: {
      fontFamily: fonts.heading,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600" as const,
      letterSpacing: -0.1,
    },
  },
  body: {
    large: {
      fontFamily: fonts.bodyRegular,
      fontSize: 16,
      lineHeight: 25,
      fontWeight: "400" as const,
    },
    default: {
      fontFamily: fonts.bodyRegular,
      fontSize: 14.5,
      lineHeight: 22,
      fontWeight: "400" as const,
    },
    small: {
      fontFamily: fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "400" as const,
    },
  },
  label: {
    large: {
      fontFamily: fonts.semibold,
      fontSize: 14.5,
      lineHeight: 20,
      fontWeight: "600" as const,
      letterSpacing: -0.1,
    },
    medium: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600" as const,
      letterSpacing: 0,
    },
    small: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600" as const,
      letterSpacing: 0.2,
    },
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0.1,
  },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
} as const;

// Soft, blurred elevation (clean clinical depth).
const soft = (y: number, radius: number, opacity: number, elev: number) => ({
  shadowColor: "#17242D",
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: elev,
});

export const shadows = {
  none: {},
  xs: soft(1, 2, 0.04, 1),
  sm: soft(2, 8, 0.06, 2),
  md: soft(4, 14, 0.08, 4),
  lg: soft(10, 26, 0.1, 8),
  xl: soft(16, 38, 0.13, 14),
} as const;

export const elevation = {
  base: shadows.xs,
  raised: shadows.sm,
  floating: shadows.md,
  overlay: shadows.lg,
} as const;

export const motion = {
  duration: { fast: 150, medium: 250, slow: 400 },
  spring: {
    gentle: { damping: 18, stiffness: 180 },
    default: { damping: 20, stiffness: 220 },
    bouncy: { damping: 12, stiffness: 200 },
    crisp: { damping: 25, stiffness: 300 },
  },
} as const;

/** Gradients — the ServRx cyan→blue brand sweep, consumed by expo-linear-gradient. */
export const gradients = {
  hero: ["#16B2A2", "#12A6AE", "#1E8FE6"] as const, // teal → cyan → blue
  teal: ["#22C3B2", "#12A096"] as const,
  cobalt: ["#3B9AEA", "#1673C0"] as const,
  light: ["#FFFFFF", "#F3F6F8"] as const,
  mist: ["#EDFBF9", "#EFF6FE"] as const,
} as const;

/** Glass — translucent frosted panels for overlays over gradients/imagery. */
export const glass = {
  light: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
  },
  lighter: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
  },
  dark: {
    backgroundColor: "rgba(15,23,42,0.30)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
  },
} as const;

export const layout = {
  screenPadding: 20,
  cardPadding: 20,
  sectionGap: 28,
  itemGap: 12,
  sidebarWidth: 248,
  sidebarCollapsedWidth: 76,
  tabBarHeight: 72,
  tabBarClearance: 96,
  chipHeight: 36,
  chipRowHeight: 44,
  contentMaxWidth: 1200,
  // Width at/above which the layout switches to the desktop sidebar shell.
  wideBreakpoint: 900,
} as const;
