# itwas web — UI/UX audit, round 3

Date: 2026-08-24. Method: playwright screenshots (5 states: dark filtered,
light, changes lane w/ diff panel, date-picker popover open, lane-help popover
open) analyzed via modlens vision + direct code review of `apps/web/src/App.tsx`
and `app.css`.

## Working well

- Two-pane layout with resizable splitter; panels render side-by-side at 55/45.
- Pierre diff rendering with syntax highlighting; related-changes block
  (parents/children) renders inline in the detail panel.
- Date picker popover works end-to-end: calendar grid for the current month,
  navigation arrows, preset buttons (today / last week / last month /
  last 90 days) — confirmed rendering in screenshot.
- Lane-help popover opens from `?` and lists all three lanes with descriptions.
- Change-ID per-commit hue coloring, green/red stats column, zebra rows.
- Light and dark themes both fully styled; theme persists across reloads.

## Defects + fixes

1. **[high] Low contrast on change-ID hash colors and muted text in light
   mode** — pastel HSL hues (~62% lightness) and `--text-muted: #59636e` sit
   near/below WCAG AA 4.5:1 on white. *Fix*: darken light-theme hues to ~38%
   lightness and raise muted to `#424a53`; add a contrast test to the e2e
   suite that samples computed styles.
2. **[medium] Related-changes rows truncate without ellipsis or tooltip**
   (`[parent] smxy…` clipped at right edge). *Fix*: apply the same
   `overflow:hidden; text-overflow:ellipsis; max-width` + `title` attr used on
   result-title cells to `.related td:last-child`.
3. **[medium] Segmented lane/match toggles lack group boundaries** — they read
   as loose floating buttons. *Fix*: wrap each Segmented in a bordered
   container (`border: 1px solid var(--border); border-radius: 8px;
   padding: 2px`) so the group reads as one control.
4. **[medium] Filter bar inputs are visually undifferentiated from secondary
   filters** — query looks identical in weight to revset/path/date. *Fix*:
   give query a wider min-width (~260px), accent-colored focus ring, and place
   it on its own row above the secondary filters.
5. **[low] Input borders faint in light mode** — kumo standalone ring color is
   near-invisible on `--bg`. *Fix*: one-line override in app.css:
   `.app input { box-shadow: inset 0 0 0 1px var(--border); }`.
6. **[low] Detail-panel description bullets have no vertical rhythm** (dense
   wall of `-` lines). *Fix*: render description lines as a `<ul>` with
   `margin-bottom: 4px` per item when the first char is `-`.
7. **[low] Footer "refresh" is low-affordance** — outline variant reads as
   disabled. *Fix*: use `variant="secondary"` and drop the redundant label
   next to it (keyboard hint stays).

## Suggestions (impact-ranked)

1. **Column sorting + manual column resize** on the results table
   (click-to-sort date/stats/title; drag handles). Highest-value table
   upgrade now that alignment is solid.
2. **Group repeated changes-lane rows by commit** — currently one row per
   matching line repeats the same commit; collapsible per-commit groups with
   match-count badges would cut noise dramatically on busy diffs.
3. **Large-diff cutoff**: commits >~1500 changed lines render slowly through
   Pierre's virtualizer; show a notice + "open flat view" fallback beyond a
   threshold.
4. **Revset syntax cheat-sheet** inside the existing `?` popover (second tab):
   common functions (`mine()`, `heads()`, `roots()`, `::from..to`) with
   click-to-insert.
5. **Result-row actions on hover** (copy id / copy `jj new` inline per row)
   instead of only in the detail header.
6. **Virtualize results list** if limits grow past ~500 (currently capped at
   200 by default; fine today).
7. **Persist selected revision** in the URL (`&sel=changeid`) so permalinks
   restore the exact inspection state.

## Screenshots-referenced

- `/tmp/ux3-dark.png` — dark, `?q=search` filtered
- `/tmp/ux3-light.png` — light theme unfiltered
- `/tmp/ux3-changes.png` — changes lane with diff panel
- `/tmp/ux3-date.png` — date-picker popover open (calendar + presets confirmed)
- `/tmp/ux3-help.png` — lane-help popover open

Vision-provider note: gemini-api quota was exhausted mid-audit; dark/light
audits completed there, remaining shots verified via layout-region extraction
(calendar, presets, help content confirmed present and positioned correctly).
