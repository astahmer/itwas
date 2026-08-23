# Search UX v2 plan

## Context

- `itwas` is a 3-file Rust TUI (`src/main.rs`, `src/search.rs`, `src/tui.rs`, ~900 LOC) that shells out to `jj` with `--ignore-working-copy`, streaming delimited records (`\x1f` field / `\x1e` record separators) parsed from `jj log --template`.
- Three lanes: `metadata` (descriptions/bookmarks/tags), `changes` (added diff lines via `--patch --git`), `snapshot` (`jj file list` + `jj file show` per file at one revision).
- The TUI debounces (75 ms), runs searches on a background thread, and kills the child once the 200-result cap is hit.
- Known bugs / gaps found while writing this plan:
  - `tui.rs::tick()` returns early when `request.query.is_empty()` → **no initial results** and stale results after clearing the query.
  - Metadata mode's `--path` only narrows which *revisions* are considered; it never matches file contents.
  - Revset errors surface raw from jj (`Error: Revision 'main' doesn't exist`) — repos without a `main` bookmark make the documented example fail.
  - `SearchResult.labels` (bookmarks/tags) is parsed but never rendered in the TUI result list.
  - `Display for SearchResult` prints the first description line twice (trailing newline makes `detail != title`).
  - Snapshot mode drops `change_id` entirely.

## Goal

Make itwas results look and read like `jj log`: colored change IDs, bookmarks, relative+absolute dates, diff stats — with working revset/path/date scoping, match counts, and results shown immediately on open.

## What

1. **Fixes**: initial/empty-query search behavior, path semantics per lane, friendly revset errors, duplicate title line, snapshot `change_id`.
2. **Result rendering (jj-style, minimal color)**:
   - Change ID rendered with jj's per-letter coloring scheme (open/closed letters), `@` marker for working copy, bookmarks in yellow/green as in default jj theme.
   - Bookmarks/tags shown inline on each result row.
3. **Dates & stats**:
   - Each result row: relative date (`2 days ago`) + absolute on preview/selection (`2026-08-21 14:03`).
   - Short diffstat `+X −Y` per revision, properly colored (+ green / − red), computed lazily for the selected revision (not per row) to keep streaming cheap; optional batched `--summary` pass if per-row proves affordable.
4. **Scoping**:
   - Revset field already exists; add bookmark quick-pick (list bookmarks via `jj bookmark list`, insert into revset field).
   - Date filter: `--since` / `--until` (CLI flags + TUI fields or prefix syntax like `>2026-08-01`), applied either client-side on fetched timestamps or translated to a jj revset function if available in the pinned jj version.
5. **Counts**: header/status shows `N matches` (plus "200+ (capped)" when the limit truncated).

## Why

Current output is plain text that loses jj's visual affordances (colored change IDs, bookmark highlighting), making scan-speed worse than the official CLI. Broken initial view and misleading `--path` behavior undermine trust in the tool's core promise.

## How

### Conceptual model

```
jj log --template(delimited fields)          jj show/diff --stat (lazy)
        │  one streaming pass                        │ on selection change
        ▼                                            ▼
  SearchResult { commit, change_id, description,
                 bookmarks[], tags[], timestamp,
                 is_working_copy, stat? }
        │
        ▼
  renderer: jj-default-theme subset
```

### Operations / behavior

| Action | Result |
|--------|--------|
| Open TUI | Search runs immediately with empty query → full history list |
| Clear query | Results reset to unfiltered scope (not stale) |
| Select row | Preview shows description, absolute date, author, diffstat; lazy `jj diff --stat` fires |
| Type in bookmark field / Ctrl-B | Bookmark quick-pick overlay; choosing inserts `<bookmark>` into revset |
| Enter on row | Print selected revision (change ID + command hint, e.g. `jj new <id>`) to stdout and exit |

### Tech choices

| Choice | Decision | Rationale |
|--------|----------|-----------|
| Date filtering client-side vs revset fn | Client-side on timestamps from template | jj revset date functions vary by version; template `committer_timestamp()` is stable. Revisit if profiling shows waste |
| Diffstat source | `jj diff --stat -r <rev>` lazy per selection | Per-row stats would break the single-streaming-pass performance contract |
| Change-ID letter coloring | Port jj's algorithm (hash-based letter stability classes) | Matches user muscle memory from official CLI |
| Relative dates | Hand-rolled formatter (~30 LOC) | Avoids pulling a time crate for one feature; `chrono`/`time` optional if timezone edge cases bite |

### Architecture

Rendering moves to span-based rows (`Vec<Span>`) instead of `format!` strings; `search.rs` gains timestamp + bookmark/tag structured fields instead of the joined `labels` string.

## What this allows

- Reading history at jj-CLI speed/familiarity inside an interactive picker.
- Scoping a search to one branch/bookmark, revset, path, or date window without remembering revset syntax.
- Trustworthy empty state: what you see on open is the actual current scope.

## What this does not allow

- No indexing/caching of history (performance contract unchanged).
- No content matching by `--path` in metadata mode beyond jj's own revision narrowing (content stays in changes/snapshot lanes).
- No rewrites/mutations of the repo (still `--ignore-working-copy` everywhere; Enter only prints a hint).

## UI & UX

```
┌ itwas ─ metadata · revset: all() · path: any ──────────────────────────────┐
│ query: │revset: main..@│path: any              1,204 matches               │
├──────────────────────────────────────────────────────────────────────────┤
│ › yqvrzwmn@  main  2 hours ago   fix reaper bug                    +12 −4 │
│   npyokuno    3 days ago     document export endpoint             +86 −0 │
│   ...                                                                    │
├─ preview ────────────────────────────────────────────────────────────────┤
│ yqvrzwmn 2026-08-23 10:12 user@example.com                               │
│ +3 −1 src/reaper.rs ...                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data model

```rust
struct SearchResult {
    commit_id: String,
    change_id: String,
    is_working_copy: bool,
    title: String,
    detail: String,
    bookmarks: Vec<String>,
    tags: Vec<String>,
    committer_timestamp: Option<i64>, // unix secs
    author: Option<String>,
    file: Option<String>,   // changes/snapshot lanes
    line: Option<usize>,
}
// stat: Option<DiffStat { added, removed }> attached lazily by the TUI
```

## Implementation steps

1. Fix tick(): run search on open + whenever scope/query changes including empty; clear results on empty query.
2. Structured fields: split `labels` into bookmarks/tags, add timestamp + author to both templates; fix duplicate-title Display bug; carry change_id in snapshot lane.
3. Friendly revset errors: detect known failure shapes ("Revision X doesn't exist", parse errors) and render actionable messages in status bar; validate revsets with a cheap `jj log -r <rs> --limit 0` probe.
4. Span-based rendering: jj-style change-id coloring, bookmark coloring, `@` marker, labels inline.
5. Dates: relative formatter for rows, absolute in preview.
6. Lazy diffstat on selection change (+ debounce/cache per revision); colored `+X −Y` on row once cached.
7. Match count in header/status incl. capped indicator.
8. Scoping: `--since/--until` flags + TUI handling; bookmark quick-pick overlay.
9. Docs: README lanes/keys update.

## Open questions

1. Enter-on-result behavior: print change ID only, or also offer actions (`jj new`, copy to clipboard)?
2. Date input style in TUI: dedicated fields (more Tab stops) vs typed prefixes in query (e.g. `after:2026-08-01 …`)?
3. Per-row diffstats: lazy-only acceptable, or try batched `--summary` pass for all visible rows?
4. Should empty-query initial search be opt-out (large monorepos where `all()` is huge)? Cap already bounds cost.
5. Minimum supported jj version to pin (template/timestamp features)?

## Acceptance criteria

- [ ] Opening TUI shows results immediately; clearing the query resets to full scope, never stale.
- [ ] `--revset` with a nonexistent bookmark produces an actionable error, not raw jj stderr.
- [ ] Result rows show colored change IDs, `@` marker, bookmarks, relative date; preview shows absolute date + author.
- [ ] Selected revision shows colored `+X −Y`; stats never block typing (lazy/debounced).
- [ ] Match count always visible, including cap indicator.
- [ ] `--since/--until` filter results correctly in all three lanes (or metadata+changes with documented snapshot caveat).
- [ ] Snapshot results include change IDs.
- [ ] Performance contract holds: still one streaming pass per search keystroke burst; no index.

## Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-23 | Plan only; no implementation yet | User asked for a plan first |
