/**
 * Routly "Teal Green" theme for the signed-in screens (Home, Routes, History,
 * Profile and the shared map shell). Source: routly-internal-screens/design.
 *
 * The auth screens still use the Material palette in `tokens.ts`. Screens and
 * components here must take every colour from this file, never a raw hex.
 *
 * Light mode only for now: to add dark mode, give `colors` a dark twin and
 * select it with `useColorScheme()`.
 */

export const colors = {
  primary: '#0A7468',
  primaryPressed: '#075A51',
  accent: '#3FD3B4',
  textOnAccent: '#0B2A26',

  background: '#F2F4F6',
  surface: '#FFFFFF',

  textPrimary: '#13202E',
  textSecondary: '#5B6878',
  textTertiary: '#4A5868',
  textLegs: '#3B4856',
  textOnPrimary: '#FFFFFF',

  border: '#E3E7EC',
  borderStrong: '#CFD6DE',
  divider: '#EEF1F3',
  handle: '#C2CAD3',
  separator: '#8A96A3',
  railDash: '#C9D0D8',
  skeleton: '#E2E8F0',

  primaryTint: '#DFF4EF',
  primaryTintBorder: '#B9E6DA',
  toggleOff: '#9AA6B2',
  iconInactive: '#6B7785',
  danger: '#B42318',
  destination: '#DC2626',
  userLocation: '#2563EB',
  userLocationHalo: 'rgba(37,99,235,0.15)',
  originRing: '#DCE7FD',
  accentHalo: 'rgba(63,211,180,0.25)',
  toastBg: '#13202E',

  dark: {
    base: '#13202E',
    field: '#1F3043',
    outline: '#34475C',
    chipText: '#DCE4EC',
    muted: '#A9B6C4',
    placeholder: '#7F8EA0',
  },

  map: {
    land: '#EEF1F3',
    park: '#D9EEDB',
    water: '#C7E2F7',
    road: '#FFFFFF',
    roadStroke: '#E3E7EC',
    label: '#5B6878',
  },

  traffic: {
    low: '#22C55E',
    medium: '#F59E0B',
    heavy: '#DC2626',
    textLight: '#15803D',
    textModerate: '#B45309',
    textHeavy: '#B42318',
  },

  /** The colours Google's live traffic layer draws (for the Profile legend). */
  trafficLayer: {
    free: '#63D668',
    moderate: '#FF974D',
    heavy: '#F23C32',
    stopped: '#811F1F',
  },
} as const;

export type Mode = 'walk' | 'metro' | 'bus' | 'auto' | 'cab' | 'bike' | 'cycle' | 'train';

export const modeColors: Record<Mode, { line: string; pillBg: string; pillText: string }> = {
  walk: { line: '#7C3AED', pillBg: '#EDE5FD', pillText: '#5B21B6' },
  metro: { line: '#16A34A', pillBg: '#DCF5E3', pillText: '#15803D' },
  bus: { line: '#2563EB', pillBg: '#DCE7FD', pillText: '#1D4ED8' },
  auto: { line: '#EAB308', pillBg: '#FFF4C2', pillText: '#7A5A00' },
  cab: { line: '#EA580C', pillBg: '#FFE6D5', pillText: '#C2410C' },
  bike: { line: '#DC2626', pillBg: '#FBE2E4', pillText: '#B42318' },
  cycle: { line: '#0A7468', pillBg: '#DFF4EF', pillText: '#0A7468' },
  train: { line: '#0D9488', pillBg: '#CCFBF1', pillText: '#0F766E' },
};

/** Registered by `useFonts` in app/_layout.tsx. Weight comes from the family, never `fontWeight`. */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  screenTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  screenSub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textTertiary },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.textPrimary },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textPrimary },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary },
  bigNumber: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  price: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.textPrimary },
  body: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  caption: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  small: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  fieldLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
  },
  badge: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3 },
  button: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textOnPrimary },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 18, xxl: 24, screen: 16 } as const;

export const radius = {
  pill: 999,
  card: 20,
  cardSm: 18,
  tile: 16,
  tileSm: 12,
  input: 14,
  iconBtn: 12,
  roundBtn: 22,
  sheet: 24,
  logo: 10,
} as const;

export const layout = {
  topBarHeight: 72,
  /** Sheet "peek" top as a fraction of the screen height (430 / 844 in the mockup). */
  sheetPeekTopRatio: 0.51,
  navBar: { width: 300, height: 72, bottomOffset: 20, activeSize: 56, inactiveSize: 48 },
  /** Clears the floating nav bar. */
  sheetContentBottomPadding: 120,
  minTouch: 44,
  /** Mockup width; scale horizontal sizes by `screenWidth / designWidth` only where noted. */
  designWidth: 390,
} as const;

/** iOS shadow + Android elevation pairs. */
export const shadows = {
  selectedCard: {
    shadowColor: colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  sheet: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  navBar: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  navActive: {
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  mapControl: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} as const;

export const theme = { colors, modeColors, fonts, type, spacing, radius, layout, shadows };
