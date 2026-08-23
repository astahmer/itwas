# itwas

Fast, small Jujutsu history search with an interactive terminal picker.

`itwas` deliberately does not build or retain a history index. It asks `jj` for
the exact revset on every search, streams output a line at a time, and stops as
soon as it reaches its result cap. That keeps memory flat and makes revsets,
bookmarks, and working-copy state authoritative immediately.

## Run

From a JJ repository:

```sh
nix develop -c cargo run --
```

Pass a query for script-friendly output, or `--tui` to open the picker with an
initial query:

```sh
nix develop -c cargo run -- migration
nix develop -c cargo run -- --mode changes --revset 'main..@' 'retryId'
nix develop -c cargo run -- --mode snapshot --revset '@-' --path src 'TaskReaper'
nix develop -c cargo run -- --tui migration
```

Build an optimized binary with:

```sh
nix develop -c cargo build --release
```

## Search lanes

- `metadata` (default): full revision descriptions, bookmarks, and tags.
- `changes`: added lines in patches throughout a revset. This answers “when
  was this text introduced?” without materializing trees.
- `snapshot`: contents of files in one revision (default `@`). JJ requires this
  revset to resolve to one revision. Files are read one at a time.

Use `--revset`, `--path`, and `--regex` (`-x`) to narrow results. Literal search
is case-insensitive; regex search preserves regex case behavior.

## Picker keys

`Tab` changes active query/revset/path field. `Ctrl-T` cycles lanes. `Ctrl-R`
toggles regex. Arrow keys move the preview selection. `Ctrl-H` shows help and
`Esc` exits.

All JJ calls use `--ignore-working-copy`, so opening the tool never snapshots
or rewrites your working copy.

## Performance contract

Metadata and change search each make one streaming JJ invocation. Snapshot
search is intentionally bounded-memory rather than pre-indexed: it lists files,
then streams one file at a time. A future optional on-disk index can accelerate
repeated large snapshot searches without changing the default correctness model.
