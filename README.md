# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## CSV VFX columns

The pack opener now reads four new CSV columns to drive the per-card finish effects:

- `diagonal_lines` (or any of `diagonal_coverage`, `finish_diagonal`, `vfx_diagonal`, `diagonalIntensity`): `0`–`100` to control how pronounced the diagonal line bands should be. `0` hides the foil band entirely and `100` shows the maximum density.
- `sparkle_flow` (or `sparkle_strength`, `sparkle_intensity`, `sparkle_rate`, `sparkle_spawn`, `finish_sparkles`): `0`–`100` as a multiplier for the sparkle intensity scale. `0` silences the sparkles; values closer to `100` make them brighter and faster.
- `sparkle_palette` (or `vfx_palette`, `finish_palette`, `diagonal_palette`, `color_palette`): comma/pipe/semicolon-separated CSS colors that define the diagonal bands and sparkle tints. If the column is missing, the palette falls back to per-finish and rarity defaults (normal/holo/reverse + chase/legendary/epic/rare/common).
- `rarity` (or `card_rarity`, `vfx_rarity`, `finish_rarity`): optional textual rarity (`chase`, `legendary`, `epic`, `rare`, `common`). If omitted, the UI derives the rarity from the card's market price (e.g., `≥$200` ⇒ `chase`, `≥$80` ⇒ `legendary`, `≥$40` ⇒ `epic`, `≥$12` ⇒ `rare`, otherwise `common`).

These columns can be added to whatever pricing CSV you point the app at. The renderer gracefully falls back to the original glow when the fields are absent.

## Per-card VFX tuning

Add the following columns if you need more control over the glint and sparkle behavior:

- `sparkle_enabled` – `0`/`1` or `false`/`true` to toggle sparkles per card.
- `sparkle_opacity`, `sparkle_intensity`, `sparkle_size`, `sparkle_speed`, `sparkle_quantity` – `0`–`100` values (percent) that scale the sparkle layer’s visibility, brightness, band width, animation speed, and density.
- `shimmer_enabled` – `0`/`1` flag for the base shimmer overlay.
- `shimmer_opacity`, `shimmer_intensity`, `shimmer_size`, `shimmer_speed` – `0`–`100` values to tweak shimmer strength, thickness, and sweep speed.
- `price_label_enabled` – show or hide the on-card pricing label.
- `price_label_font_size` – CSS `font-size` string (e.g., `10px`, `0.8rem`) applied to the price label.
- `price_label_font_color` – CSS color string used for the label text.

When a column is missing, the renderer falls back to hard-coded defaults so you only need to specify overrides for cards that require unique tuning.

## Triggering a pack rip

1. Start the React app (e.g., `npm install` then `npm run dev`); the default `src/App.jsx` just renders `PackOpener`.
2. Ensure `PackOpener` points at the CSV you want by passing `csvUrl="/path/to/your.csv"` when you render it.
3. The component loads every row, shuffles it, preloads up to 6 cards, and slots the first `handSize` cards into the animation. Once textures are ready you'll see the pack UI; clicking the pack progresses it into the stacked hand, then cards animate into the collage automatically.
4. To trigger programmatically, keep a ref to the exported `PackOpener` instance and call `pickNewHand(allCards)` after updating `allCards`/data, or reuse `handleOpenAnotherPack` (which simply reuses `pickNewHand` under the hood). For remote control, expose an endpoint that updates the CSV URL or hand size and then calls `pickNewHand`.
