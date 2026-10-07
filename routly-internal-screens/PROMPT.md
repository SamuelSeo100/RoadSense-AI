# Routly — implement the internal app screens

> Paste this whole file into Claude Code (or say: "Read `routly-internal-screens/PROMPT.md` and implement it").
> Every file referenced below is inside this `routly-internal-screens/` folder.

## 0. Context

Routly is an AI-powered multimodal route planner for Indian cities (first city: Pune). A user enters a source and destination plus a priority (fastest, cheapest, least walking, fewest transfers). The app builds route options that mix walking, bus, metro, train, auto, cab, bike taxi and cycle. It ranks them with ML personalised to the user's travel history, and shows them on a live map with live traffic.

**Sign-in and login screens already exist in this repo. Do not modify them.** Your job is everything a user sees *after* a successful login:

1. **Home** tab
2. **Routes** tab (route results)
3. **History** tab
4. **Profile** tab
5. The shared pieces they all use: top bar, live map background, draggable bottom sheet, floating pill nav bar.

Do **not** build the "Get Started" onboarding screen. It is designed separately and will be added later; it is out of scope here.

## 1. Before writing code

1. Inspect the repo. Confirm the client framework (expected: **React Native**, Expo or bare). Identify the navigation library, state management, styling approach, folder conventions, the existing auth flow, and where it navigates after login.
2. Read these files in this order:
   - `design/DESIGN_SYSTEM.md`: colours, type, spacing, radii, shadows, mode colours
   - `design/theme.ts`: drop-in tokens (adapt the import style to the repo)
   - `specs/COMPONENTS.md`: shared components and the bottom-sheet behaviour
   - `specs/SCREENS.md`: each screen, section by section, with states and interactions
   - `specs/types.ts` and `specs/mock-data.json`: data shapes and sample data
   - `reference/*.dc.html`: the approved visual mockups (see `reference/HOW_TO_READ.md`). Treat them as the visual source of truth for spacing, sizes and colours. **Do not port their HTML or JS.** Rebuild natively.
3. Write a short plan: files to create or modify, libraries to add, and how the tabs hook into the existing post-login navigation. Then implement.

If the repo is not React Native, keep every spec and token and translate the library choices to that stack.

## 2. Libraries

Prefer what the repo already has. Otherwise use:

| Need | Library |
|---|---|
| Navigation | `@react-navigation/native` + `@react-navigation/bottom-tabs`, with a **custom `tabBar`** (the floating pill) |
| Bottom sheet | `@gorhom/bottom-sheet` (+ `react-native-reanimated`, `react-native-gesture-handler`) |
| Map | `react-native-maps` (Google provider), with `showsTraffic` for the live traffic layer |
| Icons | `react-native-svg`, using the SVGs in `assets/icons/` (24×24, stroke-based, round caps). `lucide-react-native` is an acceptable match if preferred. |
| Font | **Plus Jakarta Sans** 400/500/600/700/800 (`@expo-google-fonts/plus-jakarta-sans` or bundled TTFs) |
| Location | `expo-location` or `react-native-geolocation-service` |
| Local persistence | the repo's existing store, else `@react-native-async-storage/async-storage` |

## 3. Theme and assets

- Create a single theme module from `design/theme.ts`. **No hard-coded hex values in screens or components.** Everything comes from the theme.
- App logo: `assets/logo/routly-icon.png` (teal-green "R" on an off-white square). Use it in the top bar at 36×36 with radius 10. Use `routly-icon-1024.png` for the app icon / adaptive-icon foreground if the repo has none yet. `routly-icon-tile-original.png` is the full original artwork (rounded tile + shadow) for store listings and marketing.
- Copy `assets/icons/*.svg` into the repo's icon folder and expose them as typed icon components (`<Icon name="metro" size={24} color={...} />`).

## 4. App structure after login

```
AuthStack (existing, untouched)  ──login success──▶  MainTabs
MainTabs (custom floating tab bar)
 ├─ HomeTab      → HomeScreen
 ├─ RoutesTab    → RoutesScreen        (receives {from, to} params; also reachable from Home)
 ├─ HistoryTab   → HistoryScreen
 └─ ProfileTab   → ProfileScreen
```

Every tab screen uses the same **`MapScreenLayout`** (spec in `specs/COMPONENTS.md`):

```
┌───────────────────────────┐
│ TopBar (72px, white)      │  logo · title · subtitle · search button
├───────────────────────────┤
│ LiveMap (full-bleed,      │  visible above the sheet when the sheet is at "peek"
│ behind everything)        │
├───────────────────────────┤ ← sheet "peek" top ≈ 51% of screen height
│ BottomSheet (draggable)   │  drag the handle up → "full" (sheet top = bottom of top bar,
│  scrollable content       │  map fully hidden). Drag down → back to peek.
│                           │
│   ╭───────────────────╮   │
│   │  FloatingNavBar   │   │  pill, 300×72, 20px above the bottom safe area
└───╰───────────────────╯───┘
```

## 5. Screens (summary; full detail in `specs/SCREENS.md`)

- **Home**
  - Greeting with the logged-in user's first name.
  - **AI Mode** card: toggle, free-text field ("Tell me the quickest way to Pune Station"), mic button and suggestion chips.
  - **Plan a route** panel (From/To, swap, quick chips, Find routes). The top-bar search button opens and closes it, and opening it expands the sheet to full.
  - Horizontal **route preview cards**: the selected card highlights its route on the map. Then a **Start journey** button.
  - **Tickets & rides** tiles: Metro, Bus pass, Uber/Ola, Bike taxi. These redirect to the partner app or site.
- **Routes**
  - From/To card with swap.
  - "What matters most?" priority chips. The selection re-ranks the list.
  - "Include vehicles" Car / Bike / Cycle toggle tiles. They filter results.
  - Results count with "Ranked by AI · {priority}".
  - Ranked route cards: the first gets the "★ BEST FOR YOU" badge. Each card shows time, cost, coloured mode legs, walking, transfers and traffic.
  - The map highlights the top route.
- **History**
  - Monthly stats: trips, spent, saved vs. cab.
  - "How you travel" mode-mix bar, marked "Used by AI ranking".
  - Trip list grouped by day. Tapping a trip shows its route on the map and drops the sheet to peek. Each trip has a "Repeat" action.
- **Profile**
  - Avatar (initial on a solid teal circle), name, city and phone, with Edit.
  - **Quick Launch** card (dark): toggle, 3 steps, "Change button combo".
  - Saved places.
  - Travel preferences: default priority plus toggles for Learn from my trips, Voice for AI Mode and Live traffic alerts.
  - Linked apps for booking: Uber, Ola, Pune Metro tickets.
  - Settings list and Log out. Log out uses the existing auth sign-out, then returns to the auth stack.

## 6. Data layer (mock now, real later)

- Create `services/` with interfaces from `specs/types.ts`:
  - `RoutingService.getRoutes(from, to, prefs)`
  - `HistoryService.getTrips()` and `getMonthlyStats()`
  - `AiService.parseQuery(text)`, which returns `{from?, to, priority?}`
  - `PreferencesService` (get/set)
  - `LocationService.watch()`
- Ship a **mock implementation** backed by `specs/mock-data.json` behind those interfaces. The team will later swap in the real backend (a Django/Flask API) without touching screens. Put the API base URL in config/env.
- **Ranking:**
  - Sort routes by the chosen priority using each route's `score[priority]`, lower = better.
  - Mark index 0 as `isBest`.
  - Filters: hide routes whose `vehicle` is `car`, `bike` or `cycle` when that toggle is off. Routes with no `vehicle` (bus/metro/walk) always show.
- **Preferences** (default priority, toggles, Quick Launch on/off, saved places) persist locally and sync later.
- `AiService.parseQuery` mock: match "quickest/fastest", "cheapest", "least walking", "fewest transfers". Pull the destination from text after "to"/"get to". On submit, navigate to Routes with those params.

## 7. Map behaviour

- Use the user's live location (ask permission politely, and handle denial with a "Enable location" state). Show a blue location dot.
- Draw route polylines in **mode colours** (bus `#2563EB`, metro `#16A34A`, cab `#EA580C`, walk `#7C3AED`, others in `DESIGN_SYSTEM.md`). Dash the line where the platform supports it.
- Selected route: full opacity. Other routes: 25% opacity. Profile shows no routes, only the location dot.
- Put a mode badge (circle with mode icon, white 3px ring) at the midpoint of each leg, and a red destination pin.
- Turn on the traffic layer. Overlay chips on the map:
  - "● Live location · Live traffic": dark pill, top-left, cyan dot.
  - Recenter and layers buttons: top-right, white 44×44, radius 12.
  - "TRAFFIC NOW" legend (Low/Med/Heavy): bottom-left, just above the sheet's peek position.
- Fit the map camera to the selected route inside the **visible** map area (between the top bar and the sheet's peek top). Pass bottom padding equal to the sheet height.

## 8. Quick Launch: build the settings UI only

Implement the toggle, steps and "Change button combo" UI, and store the preference. **Do not attempt to intercept Power + Volume buttons.** Third-party apps generally cannot remap hardware power-button combos on Android or iOS. Add a `TODO(quick-launch)` with these viable future triggers:

- Android: Quick Settings tile, home/lock-screen widget, app shortcut, assistant/App Actions
- iOS: Lock Screen widget, Shortcuts / Action Button

The eventual flow is: launch → "Where do you want to go?" (voice) → compact route-picker window → the chosen route becomes a live mini-map widget.

## 9. Bookings

The "Uber / Ola", "Bike taxi", "Metro" and "Bus pass" tiles, and the Profile "Connect" buttons, **redirect**. They don't book in-app:

1. Open the provider app via its documented deep link or universal link, pre-filling pickup and drop where the provider supports it.
2. Fall back to the website or the app store.

Look up each provider's current official link format. Don't guess URL schemes.

## 10. Quality bar

- Pixel-match the reference mockups: spacing, radii, font sizes/weights, colours, shadows. Mockups are 390×844 (iPhone 14-ish). Scale with the screen width and respect safe areas, notches and Android navigation bars.
- Touch targets ≥ 44pt. Every icon-only button has an `accessibilityLabel`. Toggles and chips expose `accessibilityState={{ selected | checked }}`.
- Text contrast ≥ 4.5:1. Use the secondary text colour `#5B6878` only on white or `#F2F4F6`.
- 60 fps sheet drag. No layout jumps when switching tabs. The map instance persists across tabs: lift it into the tab layout or keep one instance.
- Loading and empty states:
  - skeleton route cards
  - "No routes match your filters" with a "Reset filters" button
  - "No trips yet"
  - location permission denied
- Light mode only for now. Keep tokens structured so dark mode can be added later.
- TypeScript strict if the repo uses TS. No `any` in new code.

## 11. Done when

- [ ] Logging in lands on Home inside the 4-tab layout. The auth screens are unchanged.
- [ ] The floating pill nav switches tabs. The active tab is a 56px solid teal circle; the inactive ones are grey icons.
- [ ] On every tab the sheet drags between peek and full, and taps on the handle toggle it. At full, the map is hidden behind the sheet.
- [ ] Home: the AI Mode query navigates to Routes with parsed params. The search button opens the Plan-a-route panel and expands the sheet. Selecting a preview card changes the highlighted route and the "Start journey · {name}" label.
- [ ] Routes: the priority chips re-rank, the vehicle toggles filter, the count updates, the top card is badged, and the map follows the top route.
- [ ] History: tapping a trip updates the map, and Repeat opens Routes for that trip.
- [ ] Profile: all toggles persist across app restarts, and Log out returns to auth.
- [ ] Theme tokens are used everywhere, and Plus Jakarta Sans is loaded.
- [ ] Mock services sit behind interfaces, ready for the real API.

Finish with a summary: the files added, the libraries installed, any deviations from the spec and why, and any TODOs.
