import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Splitter } from "@ark-ui/react";
import "@cloudflare/kumo/styles/standalone";
import {
  Autocomplete,
  Badge,
  Button,
  ClipboardText,
  DatePicker,
  Empty,
  Field,
  Input,
  Loader,
  Popover,
} from "@cloudflare/kumo";
import { PatchDiff } from "@pierre/diffs/react";
import "./app.css";

type Mode = "metadata" | "changes" | "snapshot";
type MatchMode = "literal" | "regex" | "fuzzy";
type Theme = "dark" | "light";

interface SearchResult {
  commit_id: string;
  change_id: string;
  title: string;
  detail: string;
  bookmarks: string[];
  tags: string[];
  author: string | null;
  timestamp: number | null;
  file: string | null;
  line: number | null;
}

interface SearchResponse {
  truncated: boolean;
  matches: number;
  results: SearchResult[];
}

interface RelatedChange {
  relation: "parent" | "child";
  change_id: string;
  timestamp: number | null;
  title: string;
}

const LANES: Mode[] = ["metadata", "changes", "snapshot"];
const MATCH_MODES: MatchMode[] = ["literal", "regex", "fuzzy"];
const DATE_HINT_SHORT = "e.g. 2d · today";

const LANE_HELP: Record<Mode, string> = {
  metadata: "Search commit messages, bookmark and tag names",
  changes: "Search added (+) lines in every diff — find when text was introduced",
  snapshot: "Search file contents at one revision (default @)",
};

const REVSET_PRESETS: string[] = [
  "all()",
  "main..@",
  "@-",
  "mine()",
  "root()",
  "heads(all())",
  "@--",
];

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_PRESETS: [string, string][] = [
  ["today", isoDaysAgo(0)],
  ["last week", isoDaysAgo(7)],
  ["last month", isoDaysAgo(30)],
  ["last 90 days", isoDaysAgo(90)],
];

function hashHue(text: string): number {
  let hash = 0;
  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash, 31) + byte >>> 0;
  }
  return ((hash % 360) / 2) * 2;
}

function relative(timestamp: number): string {
  const delta = Date.now() / 1000 - timestamp;
  if (delta < 0) return "in the future";
  if (delta < 60) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2592000, "month"],
    [31536000, "year"],
  ];
  let last = units[0];
  for (const unit of units) {
    if (delta < unit[0]) break;
    last = unit;
  }
  const count = Math.floor(delta / last[0]);
  return `${count} ${last[1]}${count === 1 ? "" : "s"} ago`;
}

function absolute(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ChangeId({ value }: { value: string }) {
  return (
    <span className="change-id" style={{ color: `hsl(${hashHue(value)}, 85%, 62%)` }}>
      {value}
    </span>
  );
}

/** Filter diff lines to matches, keeping the hunk header above each run. */
function filterPatch(patch: string, filter: string): string[] {
  const lowered = filter.trim().toLowerCase();
  const lines = patch.split("\n");
  if (!lowered) return lines;
  const kept: string[] = [];
  let pendingHunk: string | null = null;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      pendingHunk = line;
      continue;
    }
    if (line.toLowerCase().includes(lowered)) {
      if (pendingHunk !== null) {
        kept.push(pendingHunk);
        pendingHunk = null;
      }
      kept.push(line);
    }
  }
  return kept;
}

/** Split a multi-file git patch into single-file patches (PatchDiff needs 1). */
function splitPatch(patch: string): string[] {
  return patch
    .split(/(?=^diff --git )/m)
    .map((section) => section.replace(/\n$/, ""))
    .filter((section) => section.startsWith("diff --git "));
}

function Diff({ commit, theme }: { commit: string; theme: Theme }) {
  const [diff, setDiff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    let alive = true;
    setDiff(null);
    setError(null);
    setFilter("");
    fetch(`/api/diff?commit=${encodeURIComponent(commit)}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
      .then((text) => alive && setDiff(text))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [commit]);
  if (error) return <div className="error">{error}</div>;
  if (diff === null) return <Loader />;

  const lowered = filter.trim().toLowerCase();
  const files = splitPatch(diff);
  // Pierre renders full patches natively; the fallback list serves filtering.
  if (!lowered) {
    return (
      <>
        {files.map((filePatch, index) => (
          <PatchDiff
            key={index}
            patch={filePatch}
            disableWorkerPool
            options={{
              theme: theme === "dark" ? "pierre-dark" : "pierre-light",
              // Wrap long lines instead of clipping them at the pane edge.
              overflow: "wrap",
              // Bars are quieter than the default hatched blank-line markers.
              diffIndicators: "bars",
            }}
          />
        ))}
      </>
    );
  }
  const lines = filterPatch(diff, filter);
  return (
    <>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="find within this diff…"
        autoFocus
      />
      <pre className="fallback-diff">
        {lines.map((line, i) => (
          <div key={i}>{line || " "}</div>
        ))}
      </pre>
    </>
  );
}

function Related({ commit }: { commit: string }) {
  const [related, setRelated] = useState<RelatedChange[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/related?commit=${encodeURIComponent(commit)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((body) => alive && setRelated(body))
      .catch(() => alive && setRelated([]));
    return () => {
      alive = false;
    };
  }, [commit]);
  if (related === null || related.length === 0) return null;
  return (
    <table className="related">
      <tbody>
        {related.map((change) => (
          <tr key={change.relation + change.change_id}>
            <td className={`relation ${change.relation}`}>[{change.relation}]</td>
            <td>
              <ChangeId value={change.change_id} />
            </td>
            <td className="date">
              {change.timestamp !== null ? relative(change.timestamp) : ""}
            </td>
            <td>{change.title}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small calendar/preset addon for a date filter input. */
function DateAddon({
  onPick,
}: {
  onPick: (value: string) => void;
}) {
  const [picked, setPicked] = useState<Date | undefined>(undefined);
  return (
    <Popover>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label="pick a date" title="pick a date">
          ▾
        </Button>
      </Popover.Trigger>
      <Popover.Content align="end">
        <div className="date-presets">
          {DATE_PRESETS.map(([label, iso]) => (
            <button
              key={label}
              className="button secondary"
              onClick={() => {
                onPick(iso);
                setPicked(new Date(`${iso}T12:00:00`));
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <DatePicker
          mode="single"
          selected={picked}
          onChange={(d: Date | undefined) => {
            if (d) {
              const pad = (n: number) => String(n).padStart(2, "0");
              onPick(
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
              );
              setPicked(d);
            }
          }}
        />
      </Popover.Content>
    </Popover>
  );
}

function Segmented<T extends string>({
  values,
  value,
  onChange,
}: {
  values: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <span className="segmented" role="group">
      {values.map((candidate) => (
        <Button
          key={candidate}
          variant={candidate === value ? "primary" : "ghost"}
          aria-pressed={candidate === value}
          size="sm"
          onClick={() => onChange(candidate)}
        >
          {candidate}
        </Button>
      ))}
    </span>
  );
}

const VALID_MODES: Mode[] = LANES;
const VALID_MATCHES: MatchMode[] = MATCH_MODES;

/** Initial state from the URL (+ persisted theme) so links are shareable. */
function stateFromUrl(): {
  query: string;
  revset: string;
  path: string;
  after: string;
  until: string;
  mode: Mode;
  matchMode: MatchMode;
  theme: Theme;
} {
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode") as Mode | null;
  const matchParam = params.get("match") as MatchMode | null;
  const themeParam = params.get("theme");
  const storedTheme = window.localStorage.getItem("itwas-theme") as Theme | null;
  return {
    query: params.get("q") ?? "",
    revset: params.get("revset") ?? "",
    path: params.get("path") ?? "",
    after: params.get("after") ?? "",
    until: params.get("until") ?? "",
    mode: modeParam && VALID_MODES.includes(modeParam) ? modeParam : "metadata",
    matchMode:
      matchParam && VALID_MATCHES.includes(matchParam) ? matchParam : "literal",
    theme:
      themeParam === "light" || themeParam === "dark"
        ? themeParam
        : (storedTheme ?? "dark"),
  };
}

export default function App() {
  const [initial] = useState(stateFromUrl);
  const [query, setQuery] = useState(initial.query);
  const [revset, setRevset] = useState(initial.revset);
  const [path, setPath] = useState(initial.path);
  const [after, setAfter] = useState(initial.after);
  const [until, setUntil] = useState(initial.until);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [matchMode, setMatchMode] = useState<MatchMode>(initial.matchMode);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [limit, setLimit] = useState(200);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [stats, setStats] = useState<Record<string, { added: number; removed: number }>>({});
  const debounceRef = useRef<number | undefined>(undefined);
  const tableRef = useRef<HTMLTableSectionElement | null>(null);

  // Reflect the theme on <html>: data-mode drives Kumo, data-theme our vars.
  useEffect(() => {
    document.documentElement.dataset.mode = theme;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("itwas-theme", theme);
  }, [theme]);

  const results = data?.results ?? [];
  const showRefsColumn = results.some(
    (r) => r.bookmarks.length > 0 || r.tags.length > 0,
  );
  const showFileColumn =
    mode !== "metadata" && results.some((r) => r.file !== null);

  const moveSelection = useCallback(
    (delta: number) => {
      setSelected((prev) =>
        results.length === 0
          ? 0
          : Math.min(results.length - 1, Math.max(0, prev + delta)),
      );
    },
    [results.length],
  );

  const focusSelectedRow = useCallback(() => {
    const rows = tableRef.current?.querySelectorAll("tr");
    (rows?.[selected] as HTMLElement | undefined)?.focus();
  }, [selected]);

  const onFilterKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusSelectedRow();
      }
    },
    [focusSelectedRow],
  );

  // Keep the keyboard-selected row visible.
  useEffect(() => {
    tableRef.current
      ?.querySelectorAll("tr")
      [selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (mode !== "metadata") p.set("mode", mode);
    if (matchMode !== "literal") p.set("match", matchMode);
    if (theme !== "dark") p.set("theme", theme);
    if (revset.trim()) p.set("revset", revset.trim());
    if (path.trim()) p.set("path", path.trim());
    if (after.trim()) p.set("after", after.trim());
    if (until.trim()) p.set("until", until.trim());
    return p.toString();
  }, [query, revset, path, after, until, mode, matchMode, theme]);

  // Keep the address bar in sync so any search is a shareable permalink.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = params;
    window.history.replaceState(null, "", url);
  }, [params]);

  // Search immediately on mount and on every debounced change.
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/search?${params}${params ? "&" : ""}limit=${limit}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error ?? r.statusText);
          return body as SearchResponse;
        })
        .then((body) => {
          setData(body);
          setError(null);
          setSelected(0);
        })
        .catch((e) => setError(String(e)));
    }, 150);
    return () => window.clearTimeout(debounceRef.current);
  }, [params, limit]);

  // Batch-fetch diff stats for visible results.
  useEffect(() => {
    const missing = results
      .filter((r) => !(r.commit_id in stats))
      .map((r) => r.commit_id)
      .slice(0, 40);
    if (missing.length === 0) return;
    fetch(`/api/stats?commits=${missing.map(encodeURIComponent).join(",")}`)
      .then((r) => r.json())
      .then((batch: Record<string, { added: number; removed: number }>) =>
        setStats((prev) => ({ ...prev, ...batch })),
      )
      .catch(() => {});
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedResult = results[selected];
  const countLabel =
    data === null
      ? "…"
      : data.matches === 0
        ? "no matches"
        : data.truncated
          ? `${data.matches}+ matches`
          : `${data.matches} match${data.matches === 1 ? "" : "es"}`;

  return (
    <div className="app">
      <header>
        <span className="brand">itwas</span>
        <span className="tagline">jj history search</span>
        <span className="count">{countLabel}</span>
        <Button
          variant="outline"
          size="sm"
          aria-label="toggle light/dark theme"
          title="toggle light/dark theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☾ dark" : "☀ light"}
        </Button>
      </header>

      <section className="controls">
        <Input
          label="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="type to search"
          autoFocus
        />
        <div onKeyDown={onFilterKeyDown}>
        <Autocomplete
          items={REVSET_PRESETS}
          value={revset}
          onValueChange={(value) => setRevset(String(value ?? ""))}
          label="revset"
        >
          <Autocomplete.InputGroup placeholder="all()" />
          <Autocomplete.Content>
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item key={item} value={item}>
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Content>
        </Autocomplete>
        </div>
        <Input
          label="path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={onFilterKeyDown}
          placeholder="any · glob:*.rs"
        />
        <Field label="after">
          <div className="field-row">
            <Input
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              onKeyDown={onFilterKeyDown}
              placeholder={DATE_HINT_SHORT}
            />
            <DateAddon onPick={setAfter} />
          </div>
        </Field>
        <Field label="until">
          <div className="field-row">
            <Input
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              onKeyDown={onFilterKeyDown}
              placeholder={DATE_HINT_SHORT}
            />
            <DateAddon onPick={setUntil} />
          </div>
        </Field>
        <Segmented values={LANES} value={mode} onChange={setMode} />
        <Popover>
          <Popover.Trigger asChild>
            <Button variant="ghost" size="sm" aria-label="what do the lanes mean?" title="what do the lanes mean?">
              ?
            </Button>
          </Popover.Trigger>
          <Popover.Content align="start">
            <table className="lane-help">
              <tbody>
                {LANES.map((lane) => (
                  <tr key={lane}>
                    <td className="relation parent">{lane}</td>
                    <td>{LANE_HELP[lane]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Popover.Content>
        </Popover>
        <Segmented values={MATCH_MODES} value={matchMode} onChange={setMatchMode} />
      </section>

      {error && <div className="error banner">{error}</div>}

      <main>
      <Splitter.Root
        panels={[{ id: "list", minSize: 25 }, { id: "detail", minSize: 25 }]}
        defaultValue={useMemo(() => {
          try {
            const stored = window.localStorage.getItem("itwas-splitter");
            if (stored) return JSON.parse(stored) as [string, string];
          } catch {}
          return ["55", "45"];
        }, [])}
        onResizeEnd={(details) =>
          window.localStorage.setItem(
            "itwas-splitter",
            JSON.stringify(details.size),
          )
        }
      >
      <Splitter.Panel id="list">
        <div className="results-scroll">
        <table className="results">
          <thead>
            <tr>
              <th />
              <th>change</th>
              {showRefsColumn && <th>refs</th>}
              <th>date</th>
              <th>stats</th>
              {showFileColumn && <th>file</th>}
              <th className="title">title</th>
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {results.map((result, index) => {
              const stat = stats[result.commit_id];
              return (
                <tr
                  key={result.commit_id + result.title + index}
                  tabIndex={0}
                  aria-selected={index === selected}
                  className={index === selected ? "selected" : ""}
                  onClick={() => setSelected(index)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      moveSelection(1);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      moveSelection(-1);
                    } else if (e.key === "Home") {
                      e.preventDefault();
                      setSelected(0);
                    } else if (e.key === "End") {
                      e.preventDefault();
                      setSelected(results.length - 1);
                    }
                  }}
                >
                  <td className="marker">{index === selected ? "›" : ""}</td>
                  <td>
                    <ChangeId value={result.change_id} />
                  </td>
                  {showRefsColumn && (
                    <td className="refs">
                      {result.bookmarks.map((b) => (
                        <Badge
                          key={b}
                          variant={["main", "master", "trunk"].includes(b) ? "success" : "warning"}
                        >
                          {b}
                        </Badge>
                      ))}
                      {result.tags.map((t) => (
                        <Badge key={t} variant="purple">tag:{t}</Badge>
                      ))}
                    </td>
                  )}
                  <td className="date" title={result.timestamp !== null ? absolute(result.timestamp) : undefined}>
                    {result.timestamp !== null ? relative(result.timestamp) : ""}
                  </td>
                  <td className="stat">
                    {stat && (stat.added > 0 || stat.removed > 0) ? (
                      <>
                        <span className="added">+{stat.added}</span>{" "}
                        <span className="removed">−{stat.removed}</span>
                      </>
                    ) : null}
                  </td>
                  {showFileColumn && (
                    <td className="file">
                      {result.file ? (
                        <>
                          {result.file}
                          {result.line !== null ? `:${result.line}` : ""}
                          <button
                            className="copy-path"
                            aria-label={`copy path ${result.file}`}
                            title={`copy path ${result.file}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(result.file!);
                            }}
                          >
                            ⧉
                          </button>
                        </>
                      ) : null}
                    </td>
                  )}
                  <td className="title" title={result.title}>
                    {result.title || <span className="date">(no description)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {data !== null && results.length === 0 && !error && (
          <Empty title="No matches" description="Try widening the revset or clearing filters." />
        )}

        {selectedResult && (
          <aside className="detail">
            <div className="detail-head">
              <ChangeId value={selectedResult.change_id} />
              <ClipboardText size="sm" text={selectedResult.change_id} />
              {selectedResult.author && (
                <span className="author">{selectedResult.author}</span>
              )}
              {selectedResult.timestamp !== null && (
                <span className="date">{absolute(selectedResult.timestamp)}</span>
              )}
            </div>
            {selectedResult.detail.split("\n").slice(1).join("\n").trim() && (
              <p className="description">
                {selectedResult.detail.split("\n").slice(1).join("\n")}
              </p>
            )}
            <Related commit={selectedResult.commit_id} />
            <Diff commit={selectedResult.commit_id} theme={theme} />
          </aside>
        )}
      </Splitter.Panel>
      </Splitter.Root>
      </main>

      <footer>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          refresh
        </Button>
        <span>↑↓ navigate · everything the CLI does — no terminal required</span>
      </footer>
    </div>
  );
}
