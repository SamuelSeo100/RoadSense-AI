# Reading the reference mockups

These `.dc.html` files are the approved mockups, exported from the design canvas. They are **visual references, not code to port.** Rebuild them natively in React Native.

| File | Screen |
|---|---|
| `Home.dc.html` | Home tab |
| `Routes.dc.html` | Routes tab (route results) |
| `History.dc.html` | History tab |
| `Profile.dc.html` | Profile tab |
| `Map.dc.html` | Shared live-map background (all tabs) |
| `NavBar.dc.html` | Shared floating pill nav bar |

How to read them:
- Each file is HTML with **inline styles**. Those inline values (px sizes, colours, radii, gaps) are the exact design values. 1 CSS px = 1 dp/pt on a 390-wide screen.
- `{{name}}` is a value computed in the `<script>` at the bottom (`renderVals()`). Look there for conditional styles, such as the selected and unselected chip styles, or the sheet position logic (`FULL = 72`, `PEEK = 430` on an 844-tall screen).
- `<sc-for list="{{items}}" as="item">` repeats its children for each item. `<sc-if value="{{cond}}">` renders conditionally.
- `<dc-import name="Map" …>` embeds the shared component from `Map.dc.html`; `name="NavBar"` embeds `NavBar.dc.html`.
- `/_blob/…` image URLs are canvas-hosted assets. Use `../assets/logo/routly-icon.png` instead (the mockup crops a padded logo image; the asset is already cropped).
- The sheet drag in the mockup is a simple pointer handler. In the app, use `@gorhom/bottom-sheet` as described in `specs/COMPONENTS.md`.
- The map in the mockup is a hand-drawn SVG illustration. In the app, use a real map (`react-native-maps`) styled to match.
