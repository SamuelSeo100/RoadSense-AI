/**
 * RoadSense design tokens — single source of truth.
 *
 * Mirrors design/DESIGN.md. `tailwind.config.js` imports this file, so every
 * className (`bg-primary`, `text-headline-lg`, `rounded-card`…) and every
 * non-className usage (icon colors, SVG fills, shadows) reads the same values.
 *
 * Units: React Native works in dp, so all sizes are plain numbers (1rem = 16dp).
 */

/** Material 3 color roles, verbatim from the DESIGN.md front matter. */
export const colors = {
  surface: '#f8f9ff',
  'surface-dim': '#cbdbf5',
  'surface-bright': '#f8f9ff',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#eff4ff',
  'surface-container': '#e5eeff',
  'surface-container-high': '#dce9ff',
  'surface-container-highest': '#d3e4fe',
  'on-surface': '#0b1c30',
  'on-surface-variant': '#3d4947',
  'inverse-surface': '#213145',
  'inverse-on-surface': '#eaf1ff',
  outline: '#6d7a77',
  'outline-variant': '#bcc9c6',
  'surface-tint': '#006a61',
  primary: '#00685f',
  'on-primary': '#ffffff',
  'primary-container': '#008378',
  'on-primary-container': '#f4fffc',
  'inverse-primary': '#6bd8cb',
  secondary: '#565e74',
  'on-secondary': '#ffffff',
  'secondary-container': '#dae2fd',
  'on-secondary-container': '#5c647a',
  tertiary: '#bb0112',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#e02928',
  'on-tertiary-container': '#fffbff',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
  'primary-fixed': '#89f5e7',
  'primary-fixed-dim': '#6bd8cb',
  'on-primary-fixed': '#00201d',
  'on-primary-fixed-variant': '#005049',
  'secondary-fixed': '#dae2fd',
  'secondary-fixed-dim': '#bec6e0',
  'on-secondary-fixed': '#131b2e',
  'on-secondary-fixed-variant': '#3f465c',
  'tertiary-fixed': '#ffdad6',
  'tertiary-fixed-dim': '#ffb4ab',
  'on-tertiary-fixed': '#410002',
  'on-tertiary-fixed-variant': '#93000b',
  background: '#f8f9ff',
  'on-background': '#0b1c30',
  'surface-variant': '#d3e4fe',

  /** Logo hub dot (login.html hero glyph). */
  'brand-accent': '#f59e0b',

  /** Functional alerts (DESIGN.md › Functional Alerts). */
  'status-live': '#059669',
  'status-delay': '#ea580c',
  'status-cancelled': '#dc2626',

  /** Route spine + search-bar border (DESIGN.md › Components 3 & 4). */
  spine: '#cbd5e1',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Transit mode colors (DESIGN.md › Multi-Modal Color System).
 * `fg` = icon/text/line color, `bg` = tinted badge surface, `on` = text on a solid `fg` fill.
 *
 * `train` and `bike` are NOT specified in DESIGN.md — provisional values, confirm with design.
 */
export const modeColors = {
  'metro-purple': { fg: '#7c3aed', bg: '#f5f3ff', on: '#ffffff' },
  'metro-aqua': { fg: '#0284c7', bg: '#f0f9ff', on: '#ffffff' },
  bus: { fg: '#dc2626', bg: '#fef2f2', on: '#ffffff' },
  auto: { fg: '#d97706', bg: '#fef3c7', on: '#78350f' },
  cab: { fg: '#475569', bg: '#f1f5f9', on: '#ffffff' },
  walk: { fg: '#64748b', bg: '#f1f5f9', on: '#ffffff' },
  train: { fg: '#1e40af', bg: '#eff6ff', on: '#ffffff' },
  bike: { fg: '#db2777', bg: '#fdf2f8', on: '#ffffff' },
} as const;

export type ModeColorKey = keyof typeof modeColors;

/** Third-party brand marks that must keep their official colors. */
export const brandColors = {
  google: { blue: '#4285f4', green: '#34a853', yellow: '#fbbc05', red: '#ea4335' },
} as const;

/**
 * Inter font families as registered by `useFonts` in app/_layout.tsx.
 * On Android a custom font's weight must come from the family name, never from
 * `fontWeight`, so each weight is its own family.
 */
export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type FontWeightName = keyof typeof fontFamilies;

interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  /** In dp (DESIGN.md gives em; converted as em × fontSize). */
  letterSpacing: number;
  weight: FontWeightName;
}

const em = (value: number, fontSize: number) => Math.round(value * fontSize * 100) / 100;

/** Type scale (DESIGN.md › typography). */
export const typography = {
  'display-lg': { fontSize: 32, lineHeight: 38, letterSpacing: em(-0.02, 32), weight: 'bold' },
  'headline-lg': { fontSize: 24, lineHeight: 30, letterSpacing: em(-0.015, 24), weight: 'bold' },
  'headline-md': { fontSize: 20, lineHeight: 26, letterSpacing: em(-0.01, 20), weight: 'semibold' },
  'headline-sm': { fontSize: 18, lineHeight: 24, letterSpacing: 0, weight: 'semibold' },
  'title-md': { fontSize: 16, lineHeight: 22, letterSpacing: 0, weight: 'semibold' },
  'body-lg': { fontSize: 16, lineHeight: 24, letterSpacing: 0, weight: 'regular' },
  'body-md': { fontSize: 14, lineHeight: 20, letterSpacing: 0, weight: 'regular' },
  'body-sm': { fontSize: 12, lineHeight: 16, letterSpacing: 0, weight: 'regular' },
  'label-lg': { fontSize: 14, lineHeight: 18, letterSpacing: em(0.01, 14), weight: 'semibold' },
  'label-md': { fontSize: 12, lineHeight: 16, letterSpacing: em(0.02, 12), weight: 'semibold' },
  'label-sm': { fontSize: 11, lineHeight: 14, letterSpacing: em(0.03, 11), weight: 'semibold' },
  'data-metric': { fontSize: 22, lineHeight: 26, letterSpacing: em(-0.02, 22), weight: 'bold' },
  'data-time': { fontSize: 15, lineHeight: 20, letterSpacing: 0, weight: 'semibold' },
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;

/** Spacing (DESIGN.md › spacing). Tailwind's default numeric scale stays available too. */
export const spacing = {
  gutter: 16,
  margin: 16,
  'space-xs': 4,
  'space-sm': 8,
  'space-md': 12,
  'space-lg': 16,
  'space-xl': 24,
} as const;

/**
 * Corner radii.
 *
 * The scale (sm…2xl) matches the Tailwind config embedded in every Stitch export,
 * so classes copied from design/*.html render exactly like the screenshots.
 * (DESIGN.md's front matter names the steps differently; its prose — buttons 12,
 * cards 16, sheets 24 — agrees with these pixel values.) Prefer the semantic aliases.
 */
export const radii = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
  /** Inputs, buttons, quick-action bars. */
  control: 12,
  /** Journey cards, containment cards. */
  card: 16,
  /** Bottom-sheet top corners. */
  sheet: 24,
  /** Mode badges, status chips. */
  pill: 9999,
} as const;

/** Minimum touch target (DESIGN.md › Components 4). */
export const touchTarget = 48;

/**
 * Elevation tiers (DESIGN.md › Elevation & Depth), as RN `boxShadow` strings
 * (supported on the New Architecture and web).
 */
export const elevation = {
  card: '0px 1px 2px 0px rgba(15, 23, 42, 0.05)',
  selected: '0px 4px 6px -1px rgba(13, 148, 136, 0.12), 0px 2px 4px -2px rgba(13, 148, 136, 0.08)',
  sheet: '0px -4px 16px 0px rgba(15, 23, 42, 0.08)',
  header: '0px 1px 8px 0px rgba(0, 0, 0, 0.04)',
  /** Tailwind `shadow-md`, used on the logo tile in login.html. */
  raised: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
} as const;

export const tokens = {
  colors,
  modeColors,
  brandColors,
  fontFamilies,
  typography,
  spacing,
  radii,
  touchTarget,
  elevation,
} as const;
