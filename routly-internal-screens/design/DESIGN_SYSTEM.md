# Routly design system: "Teal Green"

Feel: calm, trustworthy, modern. Neutral cool-grey surfaces, one deep teal-green brand colour, a mint spark, and a deep navy anchor. **Flat colours, no gradients.**

## Brand colours

| Token | Hex | Use |
|---|---|---|
| `primary` | `#0A7468` | Brand teal green. Primary buttons, links, selected-card border, "Best for you" badge, active nav circle, avatar, switches on light surfaces, selected vehicle tiles |
| `primaryPressed` | `#075A51` | Pressed state, link hover |
| `accent` | `#3FD3B4` | Mint. Live-location dot, mic button, toggles and step numbers on dark cards |
| `textOnAccent` | `#0B2A26` | Icon/text on mint |
| `background` | `#F2F4F6` | Bottom sheet / app background |
| `surface` | `#FFFFFF` | Cards, top bar, nav bar |
| `textPrimary` | `#13202E` | Headings and main text. **Also the fill of selected priority chips** and the dark-card base |
| `textSecondary` | `#5B6878` | Captions, labels |
| `textTertiary` | `#4A5868` | Section labels ("What matters most?"), top-bar subtitles |
| `textLegs` | `#3B4856` | Legs summary on Home preview cards |
| `border` | `#E3E7EC` | Card borders, hairlines |
| `borderStrong` | `#CFD6DE` | Unselected chip/tile borders |
| `divider` | `#EEF1F3` | Row dividers inside grouped lists |
| `handle` | `#C2CAD3` | Sheet drag handle |
| `primaryTint` | `#DFF4EF` | Selected vehicle-tile fill, "AI pick" badge, "Saved" stat tile, saved-place Home icon chip |
| `primaryTintBorder` | `#B9E6DA` | Border on primaryTint tiles |
| `toggleOff` | `#9AA6B2` | Switch track when off |
| `iconInactive` | `#6B7785` | Inactive nav icons, unselected vehicle tiles |
| `danger` | `#B42318` | "Log out" |

### Dark card (AI Mode, Quick Launch)
- Background: solid `#13202E`
- Inner fields/tiles: `#1F3043`
- Outline chips/buttons on dark: border `#34475C`, text `#DCE4EC`
- Muted text on dark: `#A9B6C4`
- Toggle-on and step numbers on dark: `#3FD3B4`

## Transport mode colours (map polylines, badges, leg pills)

| Mode | Line / solid | Pill bg | Pill text |
|---|---|---|---|
| Walk | `#7C3AED` | `#EDE5FD` | `#5B21B6` |
| Metro | `#16A34A` | `#DCF5E3` | `#15803D` |
| Bus | `#2563EB` | `#DCE7FD` | `#1D4ED8` |
| Auto | `#EAB308` | `#FFF4C2` | `#7A5A00` |
| Cab | `#EA580C` | `#FFE6D5` | `#C2410C` |
| Bike taxi | `#DC2626` | `#FBE2E4` | `#B42318` |
| Cycle | `#0A7468` | `#DFF4EF` | `#0A7468` |
| Train | `#0D9488` | `#CCFBF1` | `#0F766E` |

The user-location dot is blue `#2563EB` (with a 15% halo and a white ring). The destination pin is red `#DC2626`.

## Traffic colours
Map overlay (60% opacity): Low `#22C55E`, Medium `#F59E0B`, Heavy `#DC2626`.
Traffic text on white cards: Light `#15803D`, Moderate `#B45309`, Heavy `#B42318`.

## Map style
Land `#EEF1F3`, parks `#D9EEDB`, water `#C7E2F7`, white roads.

## Typography: Plus Jakarta Sans

| Style | Size / weight | Notes |
|---|---|---|
| Screen title (top bar) | 20 / 800, letter-spacing −0.4 | "Routly", "Routes", "History", "Profile" |
| Top-bar subtitle | 12 / 600, `textTertiary` | |
| Section heading | 17 / 800 (16 on Profile) | "Routes to Pune Station" |
| Card title | 15 / 800 | "AI Mode", "Plan a route" |
| Route time big | 28 / 800, −0.5 (Routes); 22 / 800 (Home preview) | "min" suffix 12–13 / 600 secondary |
| Price | 22 / 800 (Routes); 16 / 800 (Home) | `₹` prefix |
| Body / row title | 14 / 700–800 | |
| Caption | 11–12 / 600 | secondary colour |
| Field label | 10 / 800, uppercase, letter-spacing 0.4 | "FROM", "TO" |
| Badge | 10–11 / 700–800, letter-spacing 0.3 | "★ BEST FOR YOU", "AI PICK · FITS YOUR HISTORY" |

## Spacing, radius, elevation
- Screen side padding **16**. Section gap **16–18**. Inner card padding **14–16**.
- Radii:

  | Element | Radius |
  |---|---|
  | Chip / pill | 999 |
  | Card | 18–20 |
  | Small tile | 12–16 |
  | Input | 12–14 |
  | Square icon button | 12 |
  | Round 44 button | 22 |
  | Sheet top corners | 24 |
  | Top-bar logo | 10 |

- Touch targets ≥ 44.
- Shadows:

  | Name | Value |
  |---|---|
  | `card` | none, a 1px `border` instead |
  | `selectedCard` | `0 6 18 rgba(10,116,104,0.14)` + 2px `primary` border |
  | `sheet` | `0 -8 24 rgba(19,32,46,0.14)` |
  | `navBar` | `0 10 28 rgba(19,32,46,0.18)` |
  | `navActive` | `0 6 16 rgba(10,116,104,0.35)` |
  | `mapControl` | `0 2 8 rgba(19,32,46,0.15)` |

## Component colour rules
- **Priority chips:** selected = `textPrimary` (#13202E) fill, white text, same-colour border. Unselected = white fill, `borderStrong` border, `textPrimary` text. Height 44 (Routes) / 38 (Profile).
- **Vehicle toggle tiles:** on = `primaryTint` fill, 2px `primary` border, `primary` icon and text. Off = white, 1px `borderStrong`, `iconInactive`.
- **Switch:** 52×30 track, 24 knob, 3 padding. On = `primary` (light surfaces) / `accent` (dark cards). Off = `toggleOff`.
- **Primary button:** solid `primary`, white 15/800 text, radius 14.
- **Search button (top bar):** idle = white with a 1px `border` and a `textPrimary` icon. Active = solid `primary` with a white icon.
- **"★ BEST FOR YOU" badge:** solid `primary`, white 11/700.
- **Active nav item:** a 56px solid `primary` circle with a white icon and the `navActive` shadow.
- **Route card:** white, radius 20, padding 16. The best card gets a 2px `primary` border and the `selectedCard` shadow.
- **Links:** `primary`, weight 700–800, no underline.
