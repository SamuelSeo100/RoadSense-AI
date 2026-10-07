# Screens: detailed spec

Every screen = `MapScreenLayout` (TopBar + LiveMap + BottomSheet + FloatingNavBar). Below is what goes **inside the sheet**, top to bottom, plus what the map shows. The visual reference is the matching file in `reference/`.

---

## 1. Home (`reference/Home.dc.html`)

**TopBar:** "Routly" / "Good {timeOfDay}, {user.firstName}". The search button toggles the panel.
**Map:** `mapSelection = selectedPreviewRoute.mode` (default `metro`). Draws the 3 preview routes, the user dot and the destination.

### 1a. AI Mode card (dark card)
- Header row: sparkle icon (`accent` stroke) + "AI Mode" (15/800). On the right, a Switch (on = `accent`). State `aiModeEnabled`, persisted.
- Input row: `dark.field` bg, radius 14, padding 6/6/6/14.
  - TextInput (white 14/500) with placeholder "Tell me the quickest way to Pune Station" and an accessibility label "Ask Routly".
  - Mic button: 44×44, radius 12, `accent` bg, `textOnAccent` mic icon, label "Speak your destination".
- Suggestion chips (wrap, gap 8): "Quickest to Pune Station", "Cheapest to college", "Take me home". Min height 36, outline `dark.outline`, text `dark.chipText` 12/600. Tapping one fills and submits.
- **Submit (keyboard "go" or chip):**
  1. `AiService.parseQuery(text)`
  2. navigate to the Routes tab with `{ from: currentLocation, to, priority }`
- Mic: speech-to-text if available, else show a "Voice coming soon" toast. Hidden when the "Voice for AI Mode" preference is off.
- When AI Mode is off, the input and chips collapse and only the header shows.

### 1b. Plan a route panel (conditional)
- Shown when `searchOpen` (default **false** in the app; the mockup shows it open). Toggled by the top-bar search button and closed by its own ✕.
- Card: white, **2px `primary` border**, radius 20, padding 16, gap 14, `selectedCard` shadow.
- Header: "Plan a route" (15/800) + ✕ button (36×36 round, `background` fill, label "Close search").
- Body row:
  - Left rail:
    - blue 12px origin dot with a 3px `#DCE7FD` ring
    - dashed 2px `railDash` line, 38 tall
    - 12px red square destination marker (radius 3)
  - Middle: two stacked fields (bg `background`, radius 12, padding 8×12).
    - "FROM": default "Current location · {area}"
    - "TO": placeholder "Where to?"
    - Both have place autocomplete. Mock: filter the place list from `mock-data.json`.
  - Right: swap button, 44×44, radius 12, white with a 1px `border`, label "Swap From and To".
- Quick chips: "◎ Use my location", plus a chip per saved place ("Home", "College"…). Min height 36, white with a `borderStrong` border, 12/700.
- **Find routes:** PrimaryButton (48 high, search icon + label). Navigates to Routes with `{from, to}`.

### 1c. Routes preview
- Header row: "Routes to {destination}" (17/800) + "See all" link (13/700, `primary`) → Routes tab.
- Horizontal list of `RoutePreviewCard`s (gap 10, bleeds to the screen edges with 16 inset). Up to 3: top AI pick, cheapest, fastest. The first carries "AI PICK · FITS YOUR HISTORY". Selecting a card updates the map selection.
- `PrimaryButton` (52 high): "Start journey · {selected.name}" + arrow. Starts navigation; for now a stub `TODO(navigation)` that shows a toast.
- Default destination: the user's most frequent destination from history (mock: "Pune Station").

### 1d. Tickets & rides
- "Tickets & rides" (17/800).
- 4-column grid, gap 8. Each tile: min height 84, radius 16, white with a 1px `border`, a 36px round icon chip and an 11/700 label.

  | Tile | Chip bg | Icon colour | Icon |
  |---|---|---|---|
  | Metro | `#DCF5E3` | `#15803D` | metro |
  | Bus pass | `#DCE7FD` | `#1D4ED8` | bus |
  | Uber / Ola | `#FFE6D5` | `#C2410C` | cab |
  | Bike taxi | `#FBE2E4` | `#B42318` | bike |

- Caption: "Cab and bike bookings open in the partner app." (11/600 secondary).
- Tapping a tile redirects (PROMPT §9). Uber/Ola shows an action sheet to pick the provider.

**Note:** Quick Launch is **not** on Home. It lives on Profile.

---

## 2. Routes (`reference/Routes.dc.html`)

**Params:** `{ from, to, priority? }`. Defaults: from = current location, to = last destination.
**TopBar:** "Routes" / "{from} → {to}". Search expands the sheet and focuses From.
**Map:** `mapSelection = rankedRoutes[0].mapKey` (metro/bus/cab; `all` for bike/cycle). Draw every route.

### 2a. From/To card
White, 1px `border`, radius 18, padding 10/8/10/14. Rail (10px dots, 22 dashed line) + FROM/TO inputs (14/700, a 1px `border` divider between them) + swap button (44×44).

### 2b. "What matters most?"
- Label 13/700 `textTertiary`.
- Chips (wrap, gap 8, height 44): Fastest · Cheapest · Least walking · Fewest transfers.
- Default = the user's default priority from Profile. Changing it re-ranks instantly, with a layout animation.

### 2c. "Include vehicles"
3-column grid (gap 8) of ToggleTiles: Car (car icon), Bike (bike icon), Cycle (cycle icon). All on by default. Off hides routes whose `vehicle` matches.

### 2d. Results header
Row, baseline-aligned:
- Left: "{n} routes found" (18/800), or "1 route found".
- Right: "Ranked by AI · {priority label}" (12/600 secondary).

### 2e. Route list
`RouteCard` × n, gap 16. The first is badged "★ BEST FOR YOU". Tapping a card selects it on the map and opens the route detail (`TODO(route-detail)`, the next screen to design).

Mock routes (in `mock-data.json`):

| id | Legs | Time | Cost | Walk | Transfers | Traffic | vehicle |
|---|---|---|---|---|---|---|---|
| a | Walk 5m › Metro › Auto 12m | 38 | ₹62 | 0.6 km | 1 | Light | – |
| b | Walk 8m › Bus 312 › Bus 299 › Walk 6m | 54 | ₹25 | 1.1 km | 1 | Moderate | – |
| c | Cab | 42 | ₹310 | none | Direct | Heavy | car |
| d | Bike taxi | 35 | ₹95 | 0.2 km | Direct | Moderate | bike |
| e | Cycle | 48 | ₹0 | none | Direct | Light | cycle |

**Empty state:** all filtered out → an illustration-free card: "No routes match your filters" plus a "Reset filters" text button.
**Loading:** 3 skeleton cards (shimmer on `#E2E8F0`).

---

## 3. History (`reference/History.dc.html`)

**TopBar:** "History" / "Tap a trip to see it on the map". Search → Home with the panel open.
**Map:** `mapSelection = trips[selectedIndex].mode` (default: the first trip).

### 3a. Monthly stats
3-column grid, gap 8. Each tile: radius 16, padding 12. Label 11/700, value 22/800, caption 11/600.
- Trips: white / `border`. "Trips" / "18" / "this month".
- Spent: white / `border`. "Spent" / "₹1,240" / "on travel".
- Saved: `primaryTint` bg, `primaryTintBorder` border, all text `primary`. "Saved" / "₹2,860" / "vs. cab only".

### 3b. How you travel
White card (radius 18, padding 14, gap 10):
- Header: "How you travel" (14/800) + badge "Used by AI ranking" (11/700, `primary` on `primaryTint`, pill).
- Stacked bar: 12 high, radius 6, 2px gaps. Segments are proportional and coloured by mode line colour (Metro 45, Bus 30, Cab 15, Walk 10).
- Legend (wrap, gap 12, 12/700): 8px dot + "Metro 45%" and so on.

### 3c. Trip list
Grouped by day. The day header is 12/800 secondary, uppercase, letter-spacing 0.4 ("TODAY", "YESTERDAY", "SATURDAY").

Row (a pressable): white, radius 16, padding 12, gap 12. Selected: 2px `primary` border; otherwise a 1px `border`.
- Left: 40×40 badge, radius 12, mode `pillBg` with a mode `pillText` letter (M/B/C/W, 14/800). Can use the mode icon instead of the letter.
- Middle: "{from} → {to}" (14/800) and "{time} · {modeLabel} · {duration}" (12/600 secondary).
- Right: cost (14/800) and "Repeat" (11/800 `primary`).

Behaviour:
- Tapping the row selects it, updates the map and snaps the sheet to peek.
- "Repeat" navigates to Routes with that from/to.

**Empty:** "No trips yet. Your journeys will show up here."

---

## 4. Profile (`reference/Profile.dc.html`)

**TopBar:** "Profile" / "Settings & Quick Launch". Search → Home with the panel open.
**Map:** `mapSelection = 'none'` (user dot only).

### 4a. Identity row
- 60px solid `primary` avatar circle with the user's initial (24/800 white). Use the photo if the user has one.
- Name (20/800) and "{city} · {phone}" (13/600 secondary).
- "Edit" outline pill (40 high, `borderStrong`) on the right → edit profile (`TODO`).

### 4b. Quick Launch (dark card, moved here from Home)
- Header:
  - 40×40 icon tile (`dark.field`, phone icon in `accent`)
  - "Quick Launch" (15/800) with "Works with screen off" (12/600 `dark.muted`)
  - Switch on the right (on = `accent`, persisted)
- 3-column steps: tiles with `dark.field` bg, radius 12, padding 10. A number (18/800 `accent`) above the text (11/700, line-height 1.35):
  1. "Press Power + Volume Up"
  2. "Say where you want to go"
  3. "Pick a route, it becomes a live mini-map"
- "Change button combo" outline button: 44 high, `dark.outline` border, white 13/700. Opens a picker (stub).
- See PROMPT §8: UI and preference only for now.

### 4c. Saved places
- "Saved places" (16/800).
- White grouped list: radius 18, rows divided by 1px `divider` lines.
  - Home: home icon on `primaryTint`/`primary`, 36px radius 10. "Home" (14/800) with the address or "Set address" (12/600 secondary).
  - College: college icon on `#DCE7FD`/`#1D4ED8`.
  - "+ Add a place": 14/800 `primary`.
- Rows are at least 60 high. Saved places feed the Home quick chips.

### 4d. Travel preferences
White card (radius 18, padding 14, gap 14):
- "Default priority" (12/700 `textTertiary`), then chips (38 high, 12/700) with the same 4 options. Persisted; this is the Routes default.
- Toggle rows, each with a top `divider` and 12 padding above. Title 14/800, hint 12/600 secondary, Switch (on = `primary`) on the right:
  - "Learn from my trips": "Personalise route ranking with your history"
  - "Voice for AI Mode": "Speak your destination instead of typing"
  - "Live traffic alerts": "Warn me when my route slows down"

### 4e. Linked apps for booking
White grouped list. Rows 56 high: name (14/800) on the left, "Connect" outline pill (34 high, 1px `primary` border, `primary` 12/800) on the right. Rows: Uber, Ola, Pune Metro tickets. Connecting = deep-link or OAuth later (`TODO`). Show "Connected ✓" when linked.

### 4f. Settings
White grouped list, 52-high rows (14/700): Notifications · Language · English · Help & feedback · **Log out** (14/800 `danger`). Log out confirms first, then calls the existing sign-out.
