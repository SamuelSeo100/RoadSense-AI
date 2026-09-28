# RoadSense (mobile app)

AI-powered multi-modal route planner for Pune: walk, PMPML bus, Pune Metro, suburban train, auto, cab and bike.
Expo SDK 57 · TypeScript (strict) · Expo Router · NativeWind v4.

## Setup

```bash
npm install
npm start            # then press a (Android), i (iOS) or w (web)
```

Requires Node 20+. For Android, use an emulator or Expo Go on a device.

## Scripts

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm start`         | Expo dev server                              |
| `npm run android`   | Dev server and open Android                  |
| `npm run web`       | Dev server and open web                      |
| `npm run typecheck` | `tsc --noEmit`                               |
| `npm run lint`      | ESLint (expo config + Prettier)              |
| `npm run format`    | Prettier write (sorts Tailwind classes)      |
| `npm run check`     | Typecheck and lint. **Run before every PR.** |

After changing `tailwind.config.js` or `src/theme/tokens.ts`, restart with `npx expo start --clear`.

## Environment variables

Added in Phase 4. They will be documented in `.env.example`.

## Design system

- `design/` holds the read-only Stitch exports: `DESIGN.md`, `*.html` and `*.png`. They are the visual source of truth.
- **`src/theme/tokens.ts` is the single source of truth in code.** `tailwind.config.js` imports it, so classNames and JS use identical values. Never hardcode hex colors or pixel sizes.
- Preview every token at **`/dev/tokens`**.

### UI components (`src/components/ui`)

`Screen` (safe area, header slot, keyboard avoidance) · `Text` · `Icon` · `Button` · `TextInput` · `PhoneInput` · `OtpInput` · `SegmentedTabs` · `Chip` / `ChipGroup` · `Divider` · `Card` · `Field`.

- **Always use `Text` from `@/components/ui/Text`**, never React Native's. It applies Inter; RN's falls back to the system font. Set color and weight with `tone` / `weight` props, not classes.
- Wrap every page in `Screen`. It keeps content from scrolling under the status bar.
- `cn()` in `@/lib/cn` only joins classes; it does not resolve conflicts, so never pass two classes that set the same property.

### Porting Stitch HTML to React Native

Most Stitch classes carry over unchanged (`bg-surface-container-low`, `font-label-lg text-label-lg`, `px-margin`, `gap-space-sm`, `rounded-xl`…). Watch for these differences:

| Topic               | Rule                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Font weight         | Weight comes from the Inter family, not `fontWeight`, because Android can't synthesize it. `font-regular / medium / semibold / bold` set the family. The `fontWeight` plugin is disabled. `font-headline-lg` etc. already select the correct weight. |
| Numbers             | Add `tabular-nums` to anything with times, ₹, route codes or platform numbers.                                                                                                                                                                       |
| Radii               | The scale matches the Stitch HTML (`rounded-lg` 8, `rounded-xl` 12, `rounded-2xl` 16). Prefer the semantic aliases: `rounded-control` (12), `rounded-card` (16), `rounded-sheet` (24), `rounded-pill`.                                               |
| Mode colors         | `bg-mode-bus`, `bg-mode-bus-bg`, `text-mode-bus-on` for `metro-purple`, `metro-aqua`, `bus`, `auto`, `cab`, `walk`, `train`, `bike`. For non-className use: `modeColors` from `@/theme/tokens`.                                                      |
| Touch targets       | Interactive elements need `min-h-touch` / `min-w-touch` (48dp).                                                                                                                                                                                      |
| Dynamic class names | Tailwind only compiles literal strings. Map variants to full class strings, never `` `text-${x}` ``.                                                                                                                                                 |
| Shadows             | Use `elevation.*` from tokens via `style={{ boxShadow }}`.                                                                                                                                                                                           |

## Folder conventions

```
app/                 Expo Router routes. Keep them thin: compose feature components only, no logic.
src/components/ui    Design-system primitives (Button, TextInput…)
src/components/brand Logo, AppHeader, CityBadge
src/components/transit ModeBadge, RouteCard, RouteSpine
src/features/<name>  Screens, hooks, schemas and services for one feature
src/lib              Clients (supabase, api, queryClient)
src/store            zustand stores
src/theme            tokens.ts
src/constants, src/types
design/              Stitch exports (read-only)
```

- Import from `src` with `@/…` (for example `import { colors } from '@/theme/tokens'`).
- Use named exports for components. Route files use `export default`.
