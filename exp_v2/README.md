# MAESTRO · Arm A · exp_v2 reviewer dashboard

Static HTML/CSS/JS dashboard for the exp_v2 run (agreed 16 Nov, synthesis M18). Open `index.html` by double-click or host the folder on GitHub Pages. There are no libraries, CDNs or network calls.

Built from `decisions/exp_v2/2026_11_16_exp_v2_run_scope.md` and `2026_11_16_exp_v2_handoff_synthesis.md`.

## Files
| Path | What it is |
|---|---|
| `index.html` | Page shell: Overview · Pipeline · Answer · FEM ladder · Stages · Gates · Log · Sources |
| `data/run_data.js` | **The only file to edit during the run**: stages, gates, numbers, figures, plot data, log |
| `data/demo_data.js` | Synthetic example data, loaded only by `index.html?demo=1` (bannered as not run data) |
| `assets/dashboard.js` | Renderer and SVG plot engine (bar, line, scatter, interval, free-energy step) |
| `assets/dashboard.css` | Styles, light and dark theme |
| `figures/` | Stage figures copied from the run (`S04_L2_pH_map.png` etc.) |

## Updating during the run
- **Stage status:** set `status` (`planned`, `running`, `paused`, `gate`, `done`, `skipped`, `blocked`), `progress` (0–1) and `used_h`.
- **Sessions and jobs:** append to `sessions` (`start`, `end`, `minutes`, `turns`, `cost_usd`, `note`) and `ram` (`job`, `est_gb`, `est_min`, `actual_gb`, `actual_min`, `where`).
- **Numbers:** fill `value` in a stage's `numbers`. A `null` value shows as *Pending*, so never type a guess.
- **Figures:** copy the file into `figures/` and set `src: "figures/<file>"`. The `expected` field shows the planned name until then.
- **Plots:** fill `plots.<id>.series` as a list of `{ name, where, points }` items.
  - Bar points are `{x, y, lo, hi}`.
  - Line points are `{x, y, lo, hi}`; add `band: true` for a shaded interval and `errorbars: true` for error bars.
  - Scatter points are `{x, y, label}`.
  - Interval points are `{cat, lo, hi, mid}`.
  - Step points are `{x, y}`.
  - `where` ties a series to the plot's filter values, e.g. `{ rung: "L2", qoi: "pH" }`.
- **Gates:** set `verdict` (`continue`, `adjust`, `repeat`), `date` and `notes`.
- **Answer:** fill `verdicts.L0/L1/L2` with `"not justified"`, `"justified"` or `"open"`, either as a string or as `{verdict, note}`. Fill `changes_with_fidelity` with `true`/`false` and set `recommendation`.
- **Code links:** set `meta.code_base` (the run folder or a repo URL) once the folder name is fixed. Until then, paths show as plain text.
- **Log:** append to `events` (`date`, `kind`, `text`, `planned`) and to `interventions` (`kind`: `infrastructure` or `steering`).

Bump `meta.updated` on every edit. Deep links work as `index.html#stage-S04`. Each plot can be downloaded as SVG, and its data as JSON.

## Publishing
- **People appear as roles, never names:** QC reviewer, Electrochemistry reviewer, Operator, Project lead. A public host (e.g. GitHub Pages on a free account) serves the source to anyone, comments included, so keep `run_data.js` name-free when you edit it.
- **Upload this folder only.** Do not upload the whole `MAESTRO_docs`: it holds the SOW, rubric and thresholds.
- **Sources tiles:** set `meta.links_base` to the private docs repo, e.g. `https://github.com/<org>/maestro-docs/blob/main/`. Reviewers with repo access can then open the linked documents. With `null`, the tiles link to the local folder (`../../`).
- **GitHub Pages:**
  1. Create a new repo.
  2. Add file → Upload files, using the contents of this folder.
  3. Settings → Pages → Deploy from branch `main`, folder `/root`.
  4. To update the page during the run, edit `data/run_data.js` in the GitHub web editor. Any device works, so the laptop does not have to be awake.

## Checks done
- The scripts parse under Node.
- jsdom loads the page with no console errors, in normal and demo mode.
- These interactions were exercised: stage selection, tabs, filters, legend toggles, theme, log filter, gate focus and hash routing.
- The plot SVGs were rendered and inspected.
- The page has **not** been opened in a real browser yet (the sandbox has none). Check it in Edge/Chrome before sending it to reviewers.
