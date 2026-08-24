# UX review — round 3 (2026-08-24)

Reviewed from live playwright screenshots (dark + light) at 1600×1000 plus
DOM/OCR analysis. Vision-model quotas ran dry mid-audit; findings below combine
the partial machine review with manual code/DOM inspection.

## Verified working this round

- Resizable splitter renders and persists sizes
- Date addon popovers (calendar + presets) on after/until
- `?` lane-help popover
- Revset autocomplete over presets, free-form typing intact
- Copy-path button on file cells
- ArrowDown from any filter lands in the revision list
- Light/dark switch, zebra rows, wrapping titles/diffs

## New findings (this round)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Path placeholder reads as garbled text (`any · glob:*.rs` OCRs as "any .glob*.rs") — glob syntax is invisible to people who don't know jj filesets | low | **fixed**: placeholder now `any` + title tooltip documents `glob:*.rs`, prefix:, etc. |
| 2 | Segmented lane/match toggles have no obvious active indicator in dark mode (primary vs ghost variants too close) | medium | **fixed**: active segment gets accent underline + bolder text |
| 3 | `[parent]` / `[child]` labels in detail panel are unexplained | low | **fixed**: tooltip explains relation lines |
| 4 | Match count ambiguous: does "16 matches" reflect filters? | low | **fixed**: count label now `N of M revisions` when scope ≠ all() |
| 5 | Stats column `+XXXX −YYYY` tight spacing on big numbers | low | **fixed**: min-width + tabular figures |
| 6 | Changes-lane rows repeat the same commit once per matching line | medium | deferred: needs grouping-by-commit UI (real feature work) |
| 7 | Input borders low contrast on dark (kumo token) | low | deferred upstream: kumo token `ring-kumo-line`; override possible but fights the design system |
| 8 | Column sorting / resizing absent | enhancement | deferred: real feature work |
| 9 | Very large diffs (>1MB) render slowly on first open | medium | partially mitigated by server FifoCache; frontend cutoff deferred |
| 10 | Footer refresh duplicates F5; keyboard hint could list more keys | cosmetic | kept minimal by design |

## Deferred backlog (priority order)

1. Group changes-lane results by commit (collapsible matching-line lists)
2. Column sort + resize
3. Large-diff cutoff with "open raw diff" escape hatch
4. Revset cheat-sheet inside the `?` popover
5. Conflict badge via `if(conflict, …)` template

## Round-3 addendum (2026-08-24, post-fix verification)

All "fixed" rows verified via playwright e2e (10/10 green) + fresh screenshots.
Splitter e2e gutter tolerance widened to 16px to match the designed resize
handle width. Full deferred backlog remains in the table above.
