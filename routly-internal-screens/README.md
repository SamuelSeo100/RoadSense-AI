# Routly: internal screens handoff (Teal Green theme)

Everything Claude Code needs to build Routly's post-login screens (Home, Routes, History, Profile) in the teal-green theme. Sign-in, login and the Get Started screen are **not** included. Get Started will be added later.

## How to use
1. Copy this whole `routly-internal-screens/` folder into the root of your app repo.
2. Open Claude Code in the repo and send:
   > Read `routly-internal-screens/PROMPT.md` and implement it. Start with a plan.
3. Review the plan, let it build, then run the app and check the "Done when" list at the end of `PROMPT.md`.

## What's inside
| Path | What |
|---|---|
| `PROMPT.md` | The main prompt: scope, libraries, structure, behaviour, acceptance checklist |
| `design/DESIGN_SYSTEM.md` | Colour palette, mode/traffic colours, typography, radii, shadows, component colour rules |
| `design/theme.ts` | Drop-in React Native theme tokens |
| `design/tokens.json` | The same tokens as JSON (for the web dashboard or the backend team) |
| `specs/COMPONENTS.md` | TopBar, BottomSheet (drag/snap), FloatingNavBar, LiveMap, cards, chips, toggles |
| `specs/SCREENS.md` | Section-by-section spec for each screen, with states and interactions |
| `specs/types.ts` | TypeScript data models, service interfaces and the reference ranking function |
| `specs/mock-data.json` | Sample routes, trips, stats and preferences for the mock services |
| `assets/logo/` | The teal-green Routly "R" logo (512, 1024, and the original tile artwork) |
| `assets/icons/` | 22 stroke icons (24×24) used across the screens |
| `reference/` | The approved mockups (see `reference/HOW_TO_READ.md`) |

## Palette at a glance
`#0A7468` primary teal · `#3FD3B4` mint accent · `#F2F4F6` background · `#FFFFFF` card · `#13202E` text / dark cards · `#5B6878` secondary text · `#DFF4EF` teal tint. Flat colours, no gradients.
