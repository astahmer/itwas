# itwas

Fast, small Jujutsu history search with an interactive terminal picker.

`itwas` deliberately does not build or retain a history index. It asks `jj` for
the exact revset on every search, streams output a line at a time, and stops as
soon as it reaches its result cap. That keeps memory flat and makes revsets,
bookmarks, and working-copy state authoritative immediately.

## Build & install without Nix

Nix is only used for a reproducible dev shell; the project is a plain Rust
crate and builds with any stable Rust toolchain.

1. Install Rust via [rustup](https://rustup.rs) (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).
2. Build a single-file release binary:

   ```sh
   cargo build --release
   ```

   The binary lands at `target/release/itwas` (~3 MB). It has no runtime
   dependencies beyond the OS libc — copy it anywhere and it runs.
3. Optional: install it on your `PATH` (symlinks into `~/.cargo/bin`):

   ```sh
   cargo install --path .
   ```

### Fully static Linux binary

On Linux, link against musl for a binary that runs on any distro (including
glibc-less containers):

```sh
rustup target add x86_64-unknown-linux-musl
cargo build --release --target x86_64-unknown-linux-musl
```

(macOS binaries always link the system libSystem; that is the platform norm
and still yields one portable file per macOS release.)

Cross-compiling from macOS to Linux also works via
[`cargo-zigbuild`](https://github.com/rust-cross/cargo-zigbuild) or
`cross` if you need it.

## Run

From a JJ repository:

```sh
cargo run --
```

Or, inside the Nix dev shell:

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

Build an optimized binary with `cargo build --release` (see
[Build & install](#build--install-without-nix)), with or without the Nix
shell.

## Local binary

After `cargo build --release` the single-file binary lives at:

```
/Users/astahmer/dev/itwas/target/release/itwas
```

Run it directly from any JJ repository:

```sh
/Users/astahmer/dev/itwas/target/release/itwas              # interactive picker
/Users/astahmer/dev/itwas/target/release/itwas migration   # script-friendly results
```

To stop using the absolute path, either `cargo install --path .` (symlinks into
`~/.cargo/bin`) or add a Nix package output to `flake.nix` later.

## Search lanes

- `metadata` (default): full revision descriptions, bookmarks, and tags.
- `changes`: added lines in patches throughout a revset. This answers “when
  was this text introduced?” without materializing trees.
- `snapshot`: contents of files in one revision (default `@`). JJ requires this
  revset to resolve to one revision. Files are read one at a time.

Use `--revset`, `--path`, and `--regex` (`-x`) to narrow results. Literal search
is case-insensitive; regex search preserves regex case behavior; `--fuzzy`
(`-z`) matches case-insensitive subsequences.

### Date filtering

Filter by commit date with flags or typed prefixes inside the query:

```sh
itwas --since 2026-08-01 --until 2026-08-15 migration       # inclusive day range
itwas --since 2w 'retryId'                                  # last two weeks
itwas 'after:2026-08-20 before:2026-08-23 error'            # same thing, inline
```

Accepted expressions: `YYYY-MM-DD`, `YYYY-MM-DD HH:MM`, relative `Nm`/`Nh`/
`Nd`/`Nw`, and `today`/`yesterday`/`now`. `before:`/`until:` are inclusive of
the whole named day. Date filters apply to the metadata and changes lanes.

## Picker keys

- `Tab` cycles fields: query · revset · path · after · until (dates use the
  same expressions as above).
- `Ctrl-T` changes lane. `Ctrl-R` cycles literal → regex → fuzzy.
- `Ctrl-P` cycles revset presets (`all()` → `main..@` → `mine()` → `@--`).
- `Ctrl-B` opens a bookmark quick-pick (type to filter, Enter selects).
- Arrow keys move the selection; the selected row gets an immediate diffstat
  (`+X −Y`) while visible rows are batch-prefetched in the background.
- `Ctrl-D` toggles a full colored diff of the selected revision; `PgUp`/`PgDn`
  scroll it.
- `Ctrl-A` opens the action popup: copy change id (`c`), copy `jj new <id>`
  (`n`), open the file at that line in `$EDITOR` (`e`).
- `Enter` prints the selected result plus a `jj new <id>` hint and exits.
- `Ctrl-H` toggles help. `Esc` exits.

Results render jj-style from launch: per-letter colored change ids, an `@`
working-copy marker, yellow/green bookmarks, relative dates, and a live match
count (`N matches` / `N+ matches` when capped).

## Scripting

```sh
itwas --json --limit 50 'retryId'        # machine-readable output
itwas -R ~/dev/a -R ~/dev/b 'panic'      # search several repositories
```

Exit code is 1 when no results match.

## Configuration

Optional `~/.config/itwas/config.toml`:

```toml
mode = "metadata"      # metadata | changes | snapshot
match = "literal"      # literal | regex | fuzzy
revset = "all()"
path = ""
limit = 200
```

CLI flags override the config file.

All JJ calls use `--ignore-working-copy`, so opening the tool never snapshots
or rewrites your working copy.

## Performance contract

Metadata and change search each make one streaming JJ invocation. Snapshot
search is intentionally bounded-memory rather than pre-indexed: it lists files,
then streams one file at a time. A future optional on-disk index can accelerate
repeated large snapshot searches without changing the default correctness model.
