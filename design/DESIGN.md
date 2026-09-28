---
name: RoadSense Pune Transit System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#bb0112'
  on-tertiary: '#ffffff'
  tertiary-container: '#e02928'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#410002'
  on-tertiary-fixed-variant: '#93000b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  data-metric:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.02em
  data-time:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers an unapologetically functional, authoritative, and calm public transit interface optimized for the complex urban mobility network of Pune. Designed primarily for single-handed Android portrait usage under harsh outdoor sunlight, the aesthetic is strictly utilitarian, hyper-legible, and transit-native—rejecting decorative whimsicality and generic SaaS neutrality in favor of immediate cognitive parsing.

### Visual Character
- **Utilitarian & Direct:** Information density is structured with systematic hierarchy; live delays, platform numbers, interchange friction, and ticket costs are surfaced with zero visual friction.
- **Calm & High-Contrast:** Clean slate surfaces, jet-charcoal typography, and crisp borders ensure glare-free scanning at bustling terminals like Pune Station, Swargate, and Shivajinagar.
- **Tactile Material Utility:** Android-first interactions with generous minimum 48dp touch targets, clear active press states, and tactile bottom sheets engineered for movement.

## Colors

The core palette centers on **Transit Emerald Teal** (`#0D9488`), offering a distinct public-utility signature that conveys operational efficiency and calm guidance. Surface rendering is driven by high-purity slates to ensure distinct legibility in direct sunlight.

### Multi-Modal Color System
Transit modes are distinguished by fixed semantic tokens to allow instant recognition on route cards and map overlays:
- **Metro (Pune Metro Line 1 & 2):** `#7C3AED` (Purple Line) and `#0284C7` (Aqua Line) with respective tinted surface badges (`#F5F3FF` and `#F0F9FF`).
- **Bus (PMPML City Bus):** `#DC2626` (Crimson Red-Orange) paired with `#FEF2F2` container surfaces.
- **Auto-rickshaw:** `#D97706` (Pune Metered Marigold/Amber) paired with `#FFFBEB` container surfaces.
- **Cab / Ride-hail:** `#475569` (Charcoal Slate) paired with `#F1F5F9` container surfaces.
- **Pedestrian / Walk:** `#64748B` (Cool Slate) with dashed track indicators.

### Functional Alerts
- **Live / On-Time:** `#059669` (Green-600)
- **Delays & Reroutes:** `#EA580C` (Orange-600)
- **Cancellations / Breakdown:** `#DC2626` (Red-600)
- **Base Surface Canvas:** `#F8FAFC`
- **Surface Elevation High (Cards/Sheets):** `#FFFFFF`
- **Surface Outline / Divider:** `#E2E8F0`
- **Primary Text:** `#0F172A`
- **Muted Supporting Text:** `#475569`

## Typography

Typography relies strictly on **Inter**, using font feature settings `font-feature-settings: 'tnum' on, 'cv05' on, 'zero' on` throughout the entire interface. Tabular numeric figures are mandatory across all transit times, rupee amounts (`₹`), ETAs, bus route numbers (e.g., `114A`, `VJR5`), and platform identifiers to eliminate optical wobble during real-time countdown updates.

### Rules of Usage
- **Route Codes & Identifiers:** Always uppercase and bold (`label-md` or `label-lg`) to simulate physical transit signage.
- **Price & Duration Pairing:** Total duration is presented in `title-md` bold; monetary values (`₹`) follow in `data-time` with secondary contrast.
- **Station Progression:** Station names on transit spines utilize `title-md` for interchange hubs and `body-md` for standard halts.

## Layout & Spacing

The layout is built for Android mobile portrait orientation (`360dp` to `412dp` viewport base). It utilizes a 4-column fluid layout grid with a fixed outer margin of `16px` (`1rem`) and gutters of `12px` to `16px`, ensuring edge-to-edge efficiency without cramping horizontal glanceability.

### Vertical Rhythm & Density
- **Micro Spacing (`space-xs`, `space-sm`):** Reserved for chip badges, route pill tags, dot-spine timeline connections, and live delay stamps.
- **Component Padding (`space-md`, `space-lg`):** Standard internal padding for multi-modal journey cards and search fields (`12px` vertical, `16px` horizontal).
- **Section Stack (`space-xl`):** Vertical separation between route result tiers (Fastest, Cheapest, Minimal Transfers) and sticky navigation bars.
- **One-Handed Reachability:** Bottom sheets handle all dynamic route option lists, keeping key navigation targets inside the bottom 60% of the screen height.

## Elevation & Depth

This design system avoids heavy blurred drop shadows, utilizing structured tonal layering and precise 1px borders for dependable daylight legibility.

### Surface Tiers
1. **Canvas Level (0dp):** Background container `#F8FAFC`.
2. **Card Base (1dp):** `#FFFFFF` surface accompanied by a structural `1px` border in `#E2E8F0`. Low-contrast resting shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.05)`.
3. **Interactive / Selected Card (2dp):** Surface elevated with a `1.5px` border in Transit Emerald Teal (`#0D9488`), complemented by an ambient shadow: `0 4px 6px -1px rgba(13, 148, 136, 0.12), 0 2px 4px -2px rgba(13, 148, 136, 0.08)`.
4. **Floating Action & Bottom Sheets (8dp–16dp):** `#FFFFFF` background with a crisp top border (`1px` `#E2E8F0`) and high-spread ambient occlusion: `0 -4px 16px rgba(15, 23, 42, 0.08)`.

## Shapes

The shape architecture balances modern approachable contours with industrial compactness. Elements maintain balanced corner radii to fit compact mobile viewports without sacrificing card distinctiveness.

### Radius Assignments
- **Journey Cards & Modal Bottom Sheets:** `rounded-xl` (`16px` / `1rem`) for primary containment cards; bottom sheet tops use `24px` (`1.5rem`).
- **Inputs, Buttons, and Quick-action Bars:** `rounded-lg` (`12px` / `0.75rem`) providing clear, tap-ready targets.
- **Transit Pills & Status Chips:** Full pill shape (`rounded-full` / `9999px`) for mode badges, transfer tokens, and departure countdown tags.

## Components

### 1. Multi-Modal Route Card
- **Container:** `#FFFFFF` fill, `rounded-xl`, `1px` border `#E2E8F0`, `16px` internal padding.
- **Top Row:** Horizontal progression ribbon of transport mode chips joined by directional chevrons or dotted connectors (e.g., `[Walk 4m] -> [Metro Aqua 18m] -> [PMPML Bus 12m]`).
- **Data Block:** Left-aligned total travel time (`headline-md`), arrival estimate (`body-md` in `#475569`), right-aligned fare (`data-metric` in `#0F172A`).
- **Transfer Notice:** Highlighting walking transfer distances and friction flags (e.g., "5 min walk at Nal Stop") using muted slate badges.

### 2. Transit Mode Badges & Chips
- **Height & Layout:** Fixed `24px` or `28px` height, `8px` horizontal padding, integrated modal SVG icon (`14px`), tabular bold text.
- **PMPML Bus Badge:** Red outline/surface (`#FEF2F2`), red text (`#DC2626`), route number prominent (e.g., `BUS 148`).
- **Metro Badge:** Purple (`#7C3AED`) or Aqua (`#0284C7`) solid background with stark white text and line name.
- **Auto-rickshaw Badge:** Marigold background (`#FEF3C7`), dark charcoal text (`#78350F`) with fare estimate tag.

### 3. Route Spine Timeline (Journey Detail)
- **Node Spine:** Continuous vertical line (`2px` solid `#CBD5E1`) linking modal changes.
- **Interchange Nodes:** Circular hubs (`12px` diameter) filled with the mode color.
- **Stops Discloser:** Accordion pill to collapse intermediate stations (e.g., "7 intermediate stops (14 mins)").

### 4. Interactive Inputs & Search
- **Origin / Destination Bar:** Stacked dual-input unit encased in `#FFFFFF` with `rounded-xl` and `1px` border `#CBD5E1`. 
- **Wayfinding Connectors:** Visual green departure dot and teal arrival pin connected by a fine vertical line.
- **Minimum Target Size:** All touch surfaces are guaranteed minimum `48x48dp`.

### 5. Primary Action Buttons & Filters
- **Primary CTA:** High-contrast Transit Emerald Teal fill (`#0D9488`), pure white bold text, zero elevation shadow at rest, darkening to `#0F766E` on press.
- **Filter Segment Tabs:** Low-profile pill toggles (`#F1F5F9` resting, `#0F172A` text on `#FFFFFF` active with border `#CBD5E1`).