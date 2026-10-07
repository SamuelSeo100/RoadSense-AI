// Routly theme: "Teal Green". Single source of truth for all internal screens.
// Adapt the export style to the repo (plain object, styled-components theme, NativeWind config, etc.).

export const colors = {
  primary: '#0A7468',        // teal green: brand, primary buttons, selected states
  primaryPressed: '#075A51',
  accent: '#3FD3B4',         // mint: toggles on dark cards, live dot, mic button
  textOnAccent: '#0B2A26',

  background: '#F2F4F6',     // sheet / app background
  surface: '#FFFFFF',        // cards, top bar, nav bar

  textPrimary: '#13202E',    // also the selected-chip fill and dark-card base
  textSecondary: '#5B6878',
  textTertiary: '#4A5868',
  textLegs: '#3B4856',
  textOnPrimary: '#FFFFFF',

  border: '#E3E7EC',
  borderStrong: '#CFD6DE',
  divider: '#EEF1F3',
  handle: '#C2CAD3',
  separator: '#8A96A3',      // "›" between legs
  railDash: '#C9D0D8',

  primaryTint: '#DFF4EF',
  primaryTintBorder: '#B9E6DA',
  toggleOff: '#9AA6B2',
  iconInactive: '#6B7785',
  danger: '#B42318',
  destination: '#DC2626',
  userLocation: '#2563EB',
  originRing: '#DCE7FD',

  dark: {
    base: '#13202E',
    field: '#1F3043',
    outline: '#34475C',
    chipText: '#DCE4EC',
    muted: '#A9B6C4',
  },

  map: {
    land: '#EEF1F3',
    park: '#D9EEDB',
    water: '#C7E2F7',
    road: '#FFFFFF',
  },

  traffic: {
    low: '#22C55E',
    medium: '#F59E0B',
    heavy: '#DC2626',
    textLight: '#15803D',
    textModerate: '#B45309',
    textHeavy: '#B42318',
  },
} as const;

export type Mode = 'walk' | 'metro' | 'bus' | 'auto' | 'cab' | 'bike' | 'cycle' | 'train';

export const modeColors: Record<Mode, { line: string; pillBg: string; pillText: string }> = {
  walk:  { line: '#7C3AED', pillBg: '#EDE5FD', pillText: '#5B21B6' },
  metro: { line: '#16A34A', pillBg: '#DCF5E3', pillText: '#15803D' },
  bus:   { line: '#2563EB', pillBg: '#DCE7FD', pillText: '#1D4ED8' },
  auto:  { line: '#EAB308', pillBg: '#FFF4C2', pillText: '#7A5A00' },
  cab:   { line: '#EA580C', pillBg: '#FFE6D5', pillText: '#C2410C' },
  bike:  { line: '#DC2626', pillBg: '#FBE2E4', pillText: '#B42318' },
  cycle: { line: '#0A7468', pillBg: '#DFF4EF', pillText: '#0A7468' },
  train: { line: '#0D9488', pillBg: '#CCFBF1', pillText: '#0F766E' },
};

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  screenTitle:   { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4, color: colors.textPrimary },
  screenSub:     { fontFamily: fonts.semibold, fontSize: 12, color: colors.textTertiary },
  sectionTitle:  { fontFamily: fonts.extrabold, fontSize: 17, color: colors.textPrimary },
  cardTitle:     { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textPrimary },
  sectionLabel:  { fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary },
  bigNumber:     { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.5, color: colors.textPrimary },
  price:         { fontFamily: fonts.extrabold, fontSize: 22, color: colors.textPrimary },
  body:          { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  caption:       { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  small:         { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  fieldLabel:    { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.4, color: colors.textSecondary, textTransform: 'uppercase' as const },
  badge:         { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3 },
  button:        { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textOnPrimary },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 18, xxl: 24, screen: 16 } as const;

export const radius = {
  pill: 999, card: 20, cardSm: 18, tile: 16, tileSm: 12, input: 14, iconBtn: 12,
  roundBtn: 22, sheet: 24, logo: 10,
} as const;

export const layout = {
  topBarHeight: 72,
  // Sheet "peek" top as a fraction of screen height (430 / 844 in the mockup).
  sheetPeekTopRatio: 0.51,
  navBar: { width: 300, height: 72, bottomOffset: 20, activeSize: 56, inactiveSize: 48 },
  sheetContentBottomPadding: 120, // clears the floating nav bar
  minTouch: 44,
} as const;

// iOS shadow + Android elevation pairs
export const shadows = {
  selectedCard:  { shadowColor: '#0A7468', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  sheet:         { shadowColor: '#13202E', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  navBar:        { shadowColor: '#13202E', shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
  navActive:     { shadowColor: '#0A7468', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  mapControl:    { shadowColor: '#13202E', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
} as const;

export const theme = { colors, modeColors, fonts, type, spacing, radius, layout, shadows };
export default theme;
