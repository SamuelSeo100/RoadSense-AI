# Shared components

All values reference `design/theme.ts`. Mockup sizes assume a 390×844 screen. Scale horizontal sizes by `screenWidth / 390` only where noted, and keep everything else fixed.

## MapScreenLayout
Wraps every tab screen.

```
<MapScreenLayout
  title="Routes" subtitle="Pimpri → Pune Station"
  searchAction={{ type: 'toggle' | 'expandSheet' | 'goHome', active?: boolean }}
  mapSelection="metro" | "bus" | "cab" | "all" | "none"
  routes={RouteGeometry[]}
  sheetIndex / onSheetChange
>
  {sheet content}
</MapScreenLayout>
```

Layers, back to front: `LiveMap` (absolute fill) → `BottomSheet` → `TopBar` (absolute, top) → `FloatingNavBar` (rendered by the tab navigator's custom `tabBar`).

## TopBar
- Height 72 plus the top safe-area inset, white, bottom hairline `border` (1px).
- Horizontal padding 16. Row: [logo 36×36, radius 10] gap 10 [title 20/800 + subtitle 12/600].
- Right: round 44×44 search button.
  - Idle: white with a 1px `border` and a `textPrimary` icon.
  - Active (Home, panel open): solid `primary`, white icon, no border.
- Titles and subtitles:

  | Screen | Title | Subtitle |
  |---|---|---|
  | Home | "Routly" | "Good {morning/afternoon/evening}, {firstName}" |
  | Routes | "Routes" | "{from} → {to}" |
  | History | "History" | "Tap a trip to see it on the map" |
  | Profile | "Profile" | "Settings & Quick Launch" |

- Search button behaviour:

  | Screen | Behaviour |
  |---|---|
  | Home | Toggles the Plan-a-route panel. Opening it also expands the sheet to full. |
  | Routes | Expands the sheet to full and focuses the From field. |
  | History, Profile | Switches to the Home tab with the panel open. |

## BottomSheet (`@gorhom/bottom-sheet`)
- Snap points:
  - **peek**: sheet top at ≈51% of window height (430/844)
  - **full**: sheet top at the bottom edge of the TopBar
  - Start at peek. There is no fully closed state (`enablePanDownToClose={false}`).
- Background `background` (#F2F4F6), top corners radius 24, `sheet` shadow.
- Handle: 30px tall hit area. The pill inside is 40×5, radius 3, colour `handle`. Dragging it moves the sheet. **Tapping** the handle toggles peek/full. Give it the label "Drag or tap to expand the panel" and set `accessibilityState.expanded`.
- Content is a `BottomSheetScrollView` with 16 side padding, a top padding of 2, and a **bottom padding of 120** (clears the nav bar). Sections are spaced 16–18.
- Animation: spring or timing ≈300 ms, ease-out (`cubic-bezier(0.2, 0.8, 0.2, 1)` feel).
- Each screen keeps its own sheet position while you switch tabs.

## FloatingNavBar (custom `tabBar`)
- A pill 300×72, centred horizontally, 20 above the bottom safe-area inset. White fill, radius 36, `navBar` shadow, padding 8 vertical × 12 horizontal, items spaced evenly.
- 4 items with **icons only, no labels**: Home, Routes, History, Profile (icons in `assets/icons/`, 24px).
  - **Active:** a 56×56 solid `primary` circle, a white icon (stroke 2.2) and the `navActive` shadow. It sits slightly larger than its neighbours, like a raised bubble.
  - **Inactive:** a 48×48 transparent hit area with an `iconInactive` icon (stroke 1.9).
- Accessibility: role tab, label = name, `selected` state on the active item.
- Optional: animate the active circle sliding or scaling between items (150–200 ms).

## LiveMap
- Full-bleed map behind the sheet. Use one persistent instance shared by all tabs if feasible.
- Light map style matching `colors.map`: land `#EAF1FB`, parks `#DCEFE4`, water `#BFE3F7`, white roads. Use a Google Maps JSON style.
- Turn on `showsTraffic`.
- User location: blue dot (`userLocation`) with a 15% blue halo and a 3px white ring. Label chip "You · {area}" (white, radius 10, 12/700, `mapControl` shadow).
- Routes are polylines with width 5–6 and a dash pattern of [11, 9] where supported:
  - selected route: opacity 1
  - others: 0.25
  - `none`: hidden
  - `all`: every route at opacity 1
- Mode badges: a 36px circle in the mode's line colour, a 3px white ring and a white 16px mode icon, placed at the leg midpoint.
- Destination: red pin (`destination`) plus a white label chip with the place name.
- Overlays, absolutely positioned inside the *visible* map area:
  - Top-left, 12 from the left and 12 below the top bar: dark pill `textPrimary`, white 12/700 text "Live location · Live traffic", with an 8px `accent` dot and a 4px 25% halo.
  - Top-right: a vertical stack, gap 8, of two white 44×44 buttons with radius 12 and the `mapControl` shadow. "Recenter on my location" (locate icon) and "Map layers" (layers icon).
  - Bottom-left, just above the sheet's peek top: a white legend card with radius 12. "TRAFFIC NOW" at 10/800, then Low/Med/Heavy, each a 12×4 bar in its traffic colour.
- Camera: fit the selected route with `edgePadding.bottom = sheetHeightAtPeek + 24` and `top = topBarHeight + 60`.

## RoutePreviewCard (Home, horizontal list)
- 232 wide, white, radius 18, padding 14, gap 8, left-aligned. Unselected: 1px `border`. Selected: 2px `primary` border plus the `selectedCard` shadow.
- Contents:
  - optional "AI PICK · FITS YOUR HISTORY" badge (`primaryTint` bg, `primary` text, 10/800)
  - row: time (22/800) with a " min" suffix (12/600 secondary), cost on the right (16/800)
  - row: 10px mode dot + legs summary (12/700 `textLegs`)
  - meta line (11/600 secondary)
- Tapping selects it (`accessibilityState.selected`).

## RouteCard (Routes list)
- White, radius 20, padding 16, gap 12. The best card gets a 2px `primary` border and the `selectedCard` shadow; the others a 1px `border`.
- Best only: a "★ BEST FOR YOU" pill (solid `primary`, white 11/700, padding 4×10).
- Row: time 28/800 with "min" (13/600 secondary) on the left, price 22/800 on the right.
- Legs row (wraps, gap 6): a `ModePill` per leg with a "›" separator (`separator`).
- Footer: a 1px `border` top line with 12 padding above it. A 3-column grid: Walking / Transfers / Traffic. Labels 11/600 secondary, values 14/700. Traffic uses the traffic text colour.

## ModePill
Pill bg and text come from `modeColors[mode]`. 12/700, padding 6×10, radius 8. The label is e.g. "Walk 5m", "Metro", "Bus 312", "Auto 12m", "Cab", "Bike taxi", "Cycle".

## Chip
See the DESIGN_SYSTEM component rules. Selected: `textPrimary` (#13202E) fill, white text. Unselected: white fill, `borderStrong` border.

## ToggleTile (vehicle filter)
Min height 64, radius 14, icon 26px above a 12/700 label, gap 4. On/off styles are in DESIGN_SYSTEM.

## Switch
A custom 52×30 switch (or a styled native one) matching DESIGN_SYSTEM.

## PrimaryButton
Min height 52 (Home) or 48 (panel), radius 14, solid `primary`, white 15/800 text, optional trailing arrow icon. No shadow.

## Dark cards (AI Mode, Quick Launch)
Radius 20, padding 16, gap 12, solid `dark.base` (#13202E), white text.
