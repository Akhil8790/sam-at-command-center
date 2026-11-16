# Sam & AT – Command Center v5.1

Loyalty daily-check dashboard (liquid-glass UI) with journey & campaign failure monitoring, root-cause analysis, record explorer and data-ops views.

**Live:** GitHub Pages serves `index.html`. All data shown is demo data.

- `original.html` – v1 command center
- `addon.js` / `addon.css` – v2: Journeys, Root-cause center, Record explorer, Data ops
- `addon2.js` / `addon2.css` – v3: repeat-issue history, Pre-flight predictions + countdowns, Insights (3D market view, trends, digest), Folders page, 13 themes, 3D tilt
- `build.py` – combines them into `index.html`
- `addon3.js` / `addon3.css` – v4: solar-system health, XL market drawers, Pareto + market×cause matrix, Repeat issues, Schedule, Reports, My Day, Tracker board, Following, Calendar, Wins, Logs, info buttons, theme-aware text
- `addon4.js` / `addon4.css` – v5: realistic solar system (procedural planet + sun textures), one planet per market (also in each market panel), Help center, guided tour, shortcuts, do-not-disturb, recently viewed, density, bottom-right notifications

## Connecting to Prod
See `PROD_CONNECTION.md`. The repo `data/live.js` must stay empty (demo data). A real export stays on your Mac only.
