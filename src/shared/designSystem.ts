/**
 * Plusveda Design System — "quiet premium" (2026 rev).
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The previous system was a consumer-app language — Poppins headings, 26px KPI
 * numbers in 104px colour-coded cards, gradient hero banners, 24px gutters,
 * 44px minimum buttons — applied to a data-dense trade tool. On a chemist's
 * counter PC that reads as a toy, and on a phone one number filled a third of
 * the screen. The verdict from the client was blunt and correct: big cards,
 * loose spacing, junior.
 *
 * The fix is not new colours. It is DENSITY and RESTRAINT, which is what every
 * business tool people call beautiful actually has in common (Stripe, Linear,
 * Shopify Polaris, Vercel Geist, Mercury):
 *
 *   1. Body text sits at 13–14px, not 14.5–16. Page titles at 20px, not 23.
 *   2. One typeface. Poppins is gone; Inter carries everything. A second
 *      "friendly" display family is the loudest junior tell there is.
 *   3. Weights stop at 600. Nothing in this app is 700+ any more.
 *   4. Radii are locked to 4 / 6 / 8 / 10 / 12. Mixed 14/18/22 radii on
 *      neighbouring surfaces is what makes a screen look assembled by hand.
 *   5. Borders, not shadows. A resting card is a white plane with a 1px
 *      hairline on a tinted canvas. Shadow is reserved for things that genuinely
 *      float (menus, dialogs, the FAB).
 *   6. The brand green is an ACCENT, not a surface. It marks the primary action,
 *      the active nav row, links and focus — and nothing else. Roughly 90% of
 *      pixels on any screen should be neutral. Colour that isn't carrying a
 *      status meaning is noise.
 *
 * The token *keys* are unchanged, so all ~618 `palette.*`, 138 `radius.*` and
 * every `<Text variant>` call-site re-skins from these values alone.
 */

export const palette = {
  /**
   * Ink — near-black tinted very slightly green so it belongs to the brand
   * family. Pure #000 on pure #FFF is the highest-contrast, cheapest-looking
   * pairing in UI; every considered system tints both ends.
   */
  ink: {
    900: "#0F1F1B",
    800: "#152A25",
    700: "#2C3B37",
    600: "#44534F",
    500: "#647572",
    400: "#93A19E",
    300: "#C4CDCB",
    200: "#DFE5E3",
    100: "#EDF1F0",
    50: "#F5F8F7",
  },

  /**
   * Primary brand — Plusveda green. 600 is sampled straight from the logo
   * ("plus" wordmark + leaf, #10A058); the rest is a tonal ramp around it at the
   * same hue, so the UI and the logo are the same colour family.
   *
   * NOTE: the key is still `teal` because ~100 call-sites reference
   * `palette.teal[...]`. `palette.brand` is the preferred alias going forward.
   */
  teal: {
    900: "#073C21",
    800: "#0A5730",
    700: "#0C7942",
    600: "#10A058", // ← exact logo green
    500: "#1EB86B",
    400: "#39D080",
    300: "#76DBA5",
    200: "#AEEACC",
    100: "#D6F5E7",
    50: "#EEFBF5",
  },

  // Accent — cobalt blue. Links and "sales" only; no longer a second CTA fill.
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

  // Cool neutral surfaces, tinted to match ink.
  neutral: {
    0: "#FFFFFF",
    50: "#F5F8F7",
    100: "#EDF1F0",
    200: "#DFE5E3",
    300: "#C4CDCB",
    400: "#93A19E",
    500: "#647572",
    600: "#44534F",
    700: "#2C3B37",
    800: "#152A25",
    900: "#0F1F1B",
  },

  surface: {
    primary: "#FFFFFF",
    /** App canvas. Cards are white planes ON this — never white-on-white. */
    secondary: "#F6F8F8",
    tertiary: "#F0F4F3",
    raised: "#FFFFFF",
    /** Wells, table header rows, input backgrounds. */
    sunken: "#F0F4F3",
    dark: "#101E1A",
    darkRaised: "#182924",
  },

  text: {
    primary: "#0F1F1B",
    secondary: "#3F4F4C",
    // 5.1:1 on white. This token carries every section label, hint and
    // timestamp in the app, so one wrong value fails on every screen at once.
    tertiary: "#647572",
    disabled: "#A3AFAC",
    inverse: "#FFFFFF",
    accent: "#0C7942", // brand green 700 — passes AA on white
    // 5.87:1 on white. #1E8FE6 was 3.43:1 — links are body-size text,
    // so they need the full 4.5:1, not the 3:1 allowed for large text.
    link: "#1568A8",
  },

  border: {
    /** Row dividers inside a card. */
    subtle: "#EDF1F0",
    /** The hairline. Every card, table and panel edge in the app. */
    default: "#E2E8E6",
    /** Input borders and anything that must read as interactive. */
    strong: "#CDD6D4",
    focus: "#10A058",
    dark: "#243530",
  },

  // Semantic — stock / expiry / billing states. Contrast-checked on white.
  success: { bg: "#E4F5EE", text: "#0F7A54", border: "#B7E6D3" }, // 4.73:1
  warning: { bg: "#FBF1DC", text: "#8A5A11", border: "#F3DCA6" }, // 5.27:1
  danger: { bg: "#FCEAE7", text: "#B32D1D", border: "#F6C9C1" }, // 5.46:1
  info: { bg: "#E7F1FC", text: "#1467AE", border: "#BFDDF8" }, // 5.13:1
} as const;

/**
 * Preferred alias for the primary brand ramp. New code should use
 * `palette.brand[600]`; `palette.teal[600]` is the same object, kept because
 * ~100 existing call-sites already reference it.
 */
export const brand = palette.teal;

/**
 * Status accents for metrics.
 *
 * These used to paint a 3px coloured cap and a tinted icon bubble on every KPI
 * card, which is how a dashboard ends up looking like a box of highlighters.
 * They are still here for the few places a metric genuinely carries a status
 * (expiring = red, dues = amber), but the default is now `none` — a metric with
 * no status gets no colour at all.
 */
export const accents = {
  teal: { color: "#10A058", tint: "#E9F7F0" },
  blue: { color: "#1E8FE6", tint: "#E7F1FC" },
  amber: { color: "#C1801C", tint: "#FBF1DC" },
  red: { color: "#DB4B3D", tint: "#FCEAE7" },
  purple: { color: "#7C6FE0", tint: "#EEECFB" },
  neutral: { color: "#647572", tint: "#F0F4F3" },
} as const;

/**
 * 4pt spacing grid. Semantic names, because the old string-keyed scale
 * (`spacing["1.5"]`) was hostile enough to use that it had zero call-sites in
 * the entire app while 556 raw magic numbers grew up around it.
 */
export const space = {
  none: 0,
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
} as const;

/** Back-compat numeric alias. Prefer `space`. */
export const spacing = {
  "0": 0,
  px: 1,
  "0.5": 2,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
} as const;

/**
 * Radius ladder — deliberately short. Controls 6, small surfaces 8, cards 10,
 * dialogs 12. Nothing in the product is rounder than 12 except pills.
 */
export const radius = {
  xs: 4,
  sm: 6,
  md: 8, // buttons, inputs, chips, icon wells
  lg: 10, // cards, tables, panels
  xl: 12, // dialogs, sheets, hero panels
  "2xl": 14,
  "3xl": 16,
  full: 9999,
} as const;

// Thin hairline outline.
export const outline = { width: 1, color: palette.border.default } as const;

/**
 * One family, Inter, at three weights.
 *
 * Poppins used to carry "friendly rounded headings". Mixing a geometric display
 * face into a data tool is the single clearest junior tell in the audit — every
 * system this product is measured against (Stripe, Linear, Geist, Mercury)
 * ships one grotesque throughout and gets its hierarchy from size and colour.
 *
 * `display`/`heading` now point at Inter so no call-site has to change. The
 * Poppins files are no longer loaded in App.tsx.
 */
export const fonts = {
  display: "Inter_600SemiBold",
  heading: "Inter_600SemiBold",
  bodyRegular: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_600SemiBold",
} as const;

/**
 * Tabular figures. Every rupee amount, quantity and batch count in the app must
 * use these or columns of numbers wobble — proportional digits in a money
 * column is a tell people feel without being able to name.
 */
export const numeric: { fontVariant: ["tabular-nums"] } = {
  fontVariant: ["tabular-nums"],
};

export const typography = {
  display: {
    large: {
      fontFamily: fonts.display,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "600" as const,
      letterSpacing: -0.5,
    },
    medium: {
      fontFamily: fonts.display,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "600" as const,
      letterSpacing: -0.4,
    },
    /** The KPI number. */
    small: {
      fontFamily: fonts.display,
      fontSize: 21,
      lineHeight: 26,
      fontWeight: "600" as const,
      letterSpacing: -0.3,
    },
  },
  heading: {
    /** Page title. */
    h1: {
      fontFamily: fonts.display,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "600" as const,
      letterSpacing: -0.3,
    },
    h2: {
      fontFamily: fonts.heading,
      fontSize: 17,
      lineHeight: 24,
      fontWeight: "600" as const,
      letterSpacing: -0.2,
    },
    /** Card / section title. */
    h3: {
      fontFamily: fonts.heading,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "600" as const,
      letterSpacing: -0.1,
    },
    h4: {
      fontFamily: fonts.heading,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600" as const,
      letterSpacing: 0,
    },
  },
  body: {
    large: {
      fontFamily: fonts.bodyRegular,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "400" as const,
    },
    /** Default body. */
    default: {
      fontFamily: fonts.bodyRegular,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "400" as const,
    },
    /** Table cells, secondary lines, dense lists. */
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
      fontSize: 14,
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
      // 12px is the floor for text that carries meaning; 11px reads as noise
      // on a phone and trips "text too small" audits.
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600" as const,
      letterSpacing: 0.1,
    },
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  /**
   * Eyebrow labels. Dropped to 11px with tighter tracking — at 12/1.0 it
   * competed with the page title sitting directly under it.
   */
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
} as const;

/**
 * Elevation.
 *
 * Resting surfaces get NO shadow — a hairline border on a tinted canvas does
 * the separating. These exist for things that genuinely float above the page.
 */
const soft = (y: number, blur: number, opacity: number, elev: number) => ({
  shadowColor: "#0F1F1B",
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: blur,
  elevation: elev,
});

export const shadows = {
  none: {},
  xs: soft(1, 2, 0.03, 1),
  sm: soft(1, 3, 0.05, 2),
  md: soft(4, 12, 0.07, 4),
  lg: soft(8, 24, 0.1, 8),
  xl: soft(16, 36, 0.12, 14),
} as const;

export const elevation = {
  /** Cards at rest — flat. */
  base: shadows.none,
  raised: shadows.xs,
  /** Menus, pickers, the FAB. */
  floating: shadows.md,
  /** Dialogs and sheets. */
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

/**
 * Gradients.
 *
 * The green→blue sweep is retired from product surfaces: a gradient banner at
 * the top of a working dashboard is decoration where the user wants density,
 * and it was the loudest thing on the screen. These are kept for auth/marketing
 * panels, where a brand moment is the actual job.
 */
export const gradients = {
  hero: ["#0C7942", "#0C7963", "#1873C0"] as const,
  teal: ["#0FA05C", "#0A6B3B"] as const,
  cobalt: ["#3B9AEA", "#1673C0"] as const,
  light: ["#FFFFFF", "#F6F8F8"] as const,
  mist: ["#EEFBF5", "#EFF6FE"] as const,
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

/**
 * Responsive breakpoints (min-width, px). One source of truth so "narrow vs
 * wide" behaves the same everywhere instead of each screen hardcoding 640/700/
 * 760/900/1100. Consume via the `useBreakpoint` hook.
 */
export const breakpoints = {
  sm: 640,
  md: 760,
  lg: 900,
  xl: 1100,
  xxl: 1200,
} as const;

export const layout = {
  /** Page gutter. Phones get less — 24px on a 390px screen is 12% of it. */
  screenPadding: 24,
  screenPaddingPhone: 16,
  /** Card padding — Polaris ships exactly this and it is the right number. */
  cardPadding: 16,
  cardPaddingCompact: 12,
  /** Inputs, selects, comboboxes. Consume via `useControlHeight()`. */
  controlHeight: 38,
  controlHeightPhone: 46,
  sectionGap: 24,
  itemGap: 12,
  sidebarWidth: 240,
  sidebarCollapsedWidth: 68,
  /** Sidebar nav rows. 48px was a touch target on a desktop pointer surface. */
  navRowHeight: 36,
  tabBarHeight: 64,
  tabBarClearance: 88,
  chipHeight: 30,
  chipRowHeight: 38,
  /** Table/list metrics. */
  rowHeight: 44,
  rowHeightDense: 36,
  rowHeightPhone: 60,
  tableHeaderHeight: 36,
  contentMaxWidth: 1240,
  // Width at/above which the layout switches to the desktop sidebar shell.
  wideBreakpoint: 900,
} as const;
