/**
 * Tailwind / NativeWind config. Every value comes from src/theme/tokens.ts —
 * edit tokens there, never here. (Tailwind loads configs with jiti, so the
 * TypeScript import below works.)
 *
 * @type {import('tailwindcss').Config}
 */
const {
  colors,
  modeColors,
  fontFamilies,
  typography,
  spacing,
  radii,
  touchTarget,
} = require('./src/theme/tokens.ts');

const px = (n) => `${n}px`;

/** `text-headline-lg` → size + line height + letter spacing. */
const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, t]) => [
    name,
    [px(t.fontSize), { lineHeight: px(t.lineHeight), letterSpacing: px(t.letterSpacing) }],
  ]),
);

/**
 * Weight lives in the font family (see tokens.ts › fontFamilies), so:
 *  - `font-headline-lg` etc. pick the family that type style is specified with
 *  - `font-regular|medium|semibold|bold` override it
 * Style keys come first so an explicit weight class wins, as in the Stitch HTML.
 */
const fontFamily = {
  sans: [fontFamilies.regular],
  ...Object.fromEntries(
    Object.entries(typography).map(([name, t]) => [name, [fontFamilies[t.weight]]]),
  ),
  regular: [fontFamilies.regular],
  normal: [fontFamilies.regular],
  medium: [fontFamilies.medium],
  semibold: [fontFamilies.semibold],
  bold: [fontFamilies.bold],
};

/** `bg-mode-bus`, `bg-mode-bus-bg`, `text-mode-bus-on` … */
const mode = Object.fromEntries(
  Object.entries(modeColors).map(([name, c]) => [name, { DEFAULT: c.fg, bg: c.bg, on: c.on }]),
);

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // `fontWeight` is disabled on purpose: `font-bold` etc. map to Inter families above.
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      colors: { ...colors, mode },
      fontSize,
      fontFamily,
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, px(v)])),
      borderRadius: Object.fromEntries(Object.entries(radii).map(([k, v]) => [k, px(v)])),
      minHeight: { touch: px(touchTarget) },
      minWidth: { touch: px(touchTarget) },
    },
  },
  plugins: [],
};
