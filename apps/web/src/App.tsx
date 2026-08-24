import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Splitter } from "@ark-ui/react";
import "./kumo/styles/kumo-standalone.css";
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
} from "./kumo";
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

type SortKey = "change" | "date" | "stats" | "title";
interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const LANES: Mode[] = ["metadata", "changes", "snapshot"];
const MATCH_MODES: MatchMode[] = ["literal", "regex", "fuzzy"];
const DATE_HINT_SHORT = "e.g. 2d · today";

const LANE_HELP: Record<Mode, string> = {
  metadata: "Search commit messages, bookmark and tag names",
  changes: "Search added (+) lines in every diff — find when text was introduced",
  snapshot: "Search file contents at one revision (default @)",
};

const REVSET_CHEATSHEET: [string, string][] = [
  ["all()", "every revision in the repo"],
  ["mine()", "revisions authored by you"],
  ["main..@", "commits on your branch not on main"],
  ["@-", "parent of the working copy"],
  ["root()", "the empty root commit"],
  ["heads(all())", "tip revisions (branch heads)"],
  ["::main", "all ancestors of main"],
  ["conflicts()", "revisions with merge conflicts"],
];

const SORTABLE_COLUMNS: SortKey[] = ["change", "date", "stats", "title"];
const ROW_HEIGHT = 28;
const WINDOW_OVERSCAN = 10;

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
  const [forceFlat, setForceFlat] = useState(false);
  useEffect(() => {
    let alive = true;
    setDiff(null);
    setError(null);
    setFilter("");
    setForceFlat(false);
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

  // Large-diff cutoff: Pierre's virtualizer chokes on huge patches, so offer
  // a flat fallback instead. maxdiff=<bytes> query param overrides for tests.
  const maxDiffParam = Number(
    new URLSearchParams(window.location.search).get("maxdiff") ?? "",
  );
  const maxDiffChars = Number.isFinite(maxDiffParam) && maxDiffParam > 0 ? maxDiffParam : 600_000;
  const diffLineCount = diff.split("\n").length;
  const tooBig = diff.length > maxDiffChars || diffLineCount > 4000;
  const useFlatView = forceFlat || tooBig;

  const lowered = filter.trim().toLowerCase();
  const files = splitPatch(diff);
  // Pierre renders full patches natively; the fallback list serves filtering.
  if (!lowered && !useFlatView) {
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
      {tooBig && !filter.trim() && (
        <div className="large-diff-notice">
          Large diff: {(diff.length / 1024).toFixed(0)} KB,{" "}
          {diffLineCount.toLocaleString()} lines — rendered as plain text.{" "}
          <Button variant="outline" size="sm" onClick={() => setForceFlat(false)}>
            try rich view anyway
          </Button>
        </div>
      )}
      <Input
        value={filter}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
        aria-label="find within diff"
        placeholder="find within this diff…"
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
            <td
              className={`relation ${change.relation}`}
              title={change.relation === "parent" ? "Direct parent of the selected revision" : "Direct child of the selected revision"}
            >
              [{change.relation}]
            </td>
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
      <Popover.Trigger
        className="trigger-button"
        aria-label="pick a date"
        title="pick a date"
      >
        ▾
      </Popover.Trigger>
      <Popover.Content align="end">
        <div className="date-presets">
          {DATE_PRESETS.map(([label, iso]) => (
            <Button
              key={label}
              variant="secondary"
              size="sm"
              onClick={() => {
                onPick(iso);
                setPicked(new Date(`${iso}T12:00:00`));
              }}
            >
              {label}
            </Button>
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
  const [helpTab, setHelpTab] = useState<"lanes" | "revsets">("lanes");
  const [limit, setLimit] = useState(200);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [stats, setStats] = useState<Record<string, { added: number; removed: number }>>({});
  const debounceRef = useRef<number | undefined>(undefined);
  const tableRef = useRef<HTMLTableSectionElement | null>(null);
  // Column sort + widths (persisted).
  const [sort, setSort] = useState<SortState | null>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("itwas-col-sort") ?? "null");
    } catch {
      return null;
    }
  });
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("itwas-col-widths") ?? "{}");
    } catch {
      return {};
    }
  });
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  // Collapsed/expanded changes-lane groups keyed by commit_id.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  // Virtualization.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);
  // ?sel= permalink target (applied once results arrive, then cleared).
  const [selTarget, setSelTarget] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("sel"),
  );

  // Reflect the theme on <html>: data-mode drives Kumo, data-theme our vars.
  useEffect(() => {
    document.documentElement.dataset.mode = theme;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("itwas-theme", theme);
  }, [theme]);

  // Track the scroll container height for windowing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight || 600);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fetched = data?.results ?? [];
  const results = useMemo(() => {
    if (!sort) return fetched;
    const dir = sort.dir === "asc" ? 1 : -1;
    const cmp = (a: SearchResult, b: SearchResult): number => {
      switch (sort.key) {
        case "change":
          return a.change_id.localeCompare(b.change_id);
        case "date":
          return (a.timestamp ?? Number.NEGATIVE_INFINITY) - (b.timestamp ?? Number.NEGATIVE_INFINITY);
        case "stats": {
          const sa = stats[a.commit_id];
          const sb = stats[b.commit_id];
          const va = sa ? sa.added + sa.removed : -1;
          const vb = sb ? sb.added + sb.removed : -1;
          return va - vb;
        }
        case "title":
          return a.title.localeCompare(b.title);
      }
    };
    return [...fetched].sort(cmp) as SearchResult[];
  }, [fetched, sort, stats]);
  const showRefsColumn = results.some(
    (r) => r.bookmarks.length > 0 || r.tags.length > 0,
  );
  const showFileColumn =
    mode !== "metadata" && results.some((r) => r.file !== null);

  type FlatRow =
    | { kind: "group"; key: string; rep: SearchResult; count: number; result: SearchResult }
    | { kind: "line"; result: SearchResult };

  const flatRows = useMemo<FlatRow[]>(() => {
    if (mode !== "changes") {
      return results.map((result) => ({ kind: "line", result }) as FlatRow);
    }
    const groups = new Map<string, SearchResult[]>();
    for (const r of results) {
      const bucket = groups.get(r.commit_id);
      if (bucket) bucket.push(r);
      else groups.set(r.commit_id, [r]);
    }
    const flat: FlatRow[] = [];
    Array.from(groups.entries()).forEach(([key, rows], groupIndex) => {
      flat.push({ kind: "group", key, rep: rows[0], result: rows[0], count: rows.length });
      const expanded = expandedGroups[key] ?? groupIndex === 0;
      if (expanded) {
        for (const r of rows) flat.push({ kind: "line", result: r });
      }
    });
    return flat;
  }, [mode, results, expandedGroups]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  }, []);

  const moveSelection = useCallback(
    (delta: number) => {
      setSelected((prev) =>
        flatRows.length === 0
          ? 0
          : Math.min(flatRows.length - 1, Math.max(0, prev + delta)),
      );
    },
    [flatRows.length],
  );

  const focusSelectedRow = useCallback(() => {
    rowRefs.current.get(selected)?.focus();
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
    rowRefs.current.get(selected)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const onResultsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      const next: SortState | null =
        !prev || prev.key !== key
          ? { key, dir: "asc" }
          : prev.dir === "asc"
            ? { key, dir: "desc" }
            : null;
      window.localStorage.setItem("itwas-col-sort", JSON.stringify(next));
      return next;
    });
  }, []);

  const startResize = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW =
        colWidthsRef.current[key] ??
        (key === "title" ? 320 : key === "refs" ? 140 : key === "file" ? 220 : 90);
      const onMove = (ev: MouseEvent) => {
        const width = Math.max(48, startW + ev.clientX - startX);
        setColWidths((prev) => ({ ...prev, [key]: width }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.localStorage.setItem(
          "itwas-col-widths",
          JSON.stringify(colWidthsRef.current),
        );
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const insertRevset = useCallback((token: string) => {
    setRevset((prev) => (prev.trim() ? `${prev.trimEnd()} ${token}` : token));
  }, []);

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

  // Apply ?sel=<change_id> once results are available.
  useEffect(() => {
    if (!selTarget || flatRows.length === 0) return;
    const index = flatRows.findIndex((row) => row.result.change_id === selTarget);
    if (index >= 0) {
      setSelected(index);
      setSelTarget(null);
    }
  }, [selTarget, flatRows]);

  // Mirror the selected revision into the URL (skipped while a deep-link
  // sel is still pending so it isn't stripped before it can be applied).
  useEffect(() => {
    if (selTarget) return;
    const url = new URL(window.location.href);
    const current = flatRows[selected]?.result.change_id;
    let changed = false;
    if (current) {
      if (url.searchParams.get("sel") !== current) {
        url.searchParams.set("sel", current);
        changed = true;
      }
    } else if (url.searchParams.has("sel")) {
      url.searchParams.delete("sel");
      changed = true;
    }
    if (changed) window.history.replaceState(null, "", url);
  }, [selected, flatRows, selTarget]);

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

  const selectedResult = flatRows[selected]?.result;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - WINDOW_OVERSCAN);
  const end = Math.min(
    flatRows.length,
    Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + WINDOW_OVERSCAN,
  );
  const isScoped =
    Boolean(revset.trim()) ||
    Boolean(path.trim()) ||
    Boolean(after.trim()) ||
    Boolean(until.trim()) ||
    query.trim().length > 0;
  const countLabel =
    data === null
      ? "…"
      : data.matches === 0
        ? "no matches"
        : data.truncated
          ? `${data.matches}+ matches`
          : `${data.matches} match${data.matches === 1 ? "" : "es"}${isScoped ? " (scoped)" : ""}`;

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
        <div onKeyDown={onFilterKeyDown}>
          <Input
            label="query"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            aria-label="query"
            placeholder="type to search"
            autoFocus
          />
        </div>
        <div onKeyDown={onFilterKeyDown}>
        <Autocomplete
          items={REVSET_PRESETS}
          value={revset}
          onValueChange={(value: unknown) => setRevset(String(value ?? ""))}
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
        <div onKeyDown={onFilterKeyDown}>
          <Input
            label="path"
            value={path}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPath(e.target.value)}
            aria-label="path filter"
            placeholder="any · glob:*.rs"
          />
        </div>
        <Field label="after">
          <div className="field-row" onKeyDown={onFilterKeyDown}>
            <Input
              value={after}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAfter(e.target.value)}
              aria-label="after date"
              placeholder={DATE_HINT_SHORT}
            />
            <DateAddon onPick={setAfter} />
          </div>
        </Field>
        <Field label="until">
          <div className="field-row" onKeyDown={onFilterKeyDown}>
            <Input
              value={until}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUntil(e.target.value)}
              aria-label="until date"
              placeholder={DATE_HINT_SHORT}
            />
            <DateAddon onPick={setUntil} />
          </div>
        </Field>
        <Segmented values={LANES} value={mode} onChange={setMode} />
        <Popover>
          <Popover.Trigger
        className="trigger-button"
        aria-label="what do the lanes mean?"
        title="what do the lanes mean?"
      >
        ?
      </Popover.Trigger>
          <Popover.Content align="start">
            <div className="help-tabs">
              <Button
                variant={helpTab === "lanes" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setHelpTab("lanes")}
              >
                Lanes
              </Button>
              <Button
                variant={helpTab === "revsets" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setHelpTab("revsets")}
              >
                Revsets
              </Button>
            </div>
            {helpTab === "lanes" ? (
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
            ) : (
              <table className="lane-help cheatsheet">
                <tbody>
                  {REVSET_CHEATSHEET.map(([token, description]) => (
                    <tr key={token}>
                      <td>
                        <button
                          className="cheatsheet-token"
                          title={`insert into revset field`}
                          onClick={() => insertRevset(token)}
                        >
                          {token}
                        </button>
                      </td>
                      <td>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
        <div
          className="results-scroll"
          ref={scrollRef}
          onScroll={onResultsScroll}
        >
        <table className="results">
          <colgroup>
            <col style={colWidths.marker ? { width: colWidths.marker } : undefined} />
            <col style={colWidths.change ? { width: colWidths.change } : undefined} />
            {showRefsColumn && <col style={colWidths.refs ? { width: colWidths.refs } : undefined} />}
            <col style={colWidths.date ? { width: colWidths.date } : undefined} />
            <col style={colWidths.stats ? { width: colWidths.stats } : undefined} />
            {showFileColumn && <col style={colWidths.file ? { width: colWidths.file } : undefined} />}
            <col />
          </colgroup>
          <thead>
            <tr>
              <th />
              {SORTABLE_COLUMNS.map((key) => {
                const label = key === "change" ? "change" : key;
                const active = sort?.key === key;
                return (
                  <th
                    key={key}
                    style={colWidths[key] ? { width: colWidths[key] } : undefined}
                    aria-sort={
                      active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <span className="th-inner">
                      <button
                        className="th-sort"
                        onClick={() => toggleSort(key)}
                        title={`sort by ${label}`}
                      >
                        {label}
                        {active ? (sort!.dir === "asc" ? " ▲" : " ▼") : ""}
                      </button>
                      <span
                        className="resize-handle"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`resize ${label} column`}
                        onMouseDown={(e) => startResize(key, e)}
                      />
                    </span>
                  </th>
                );
              })}
              {showRefsColumn && (
                <th style={colWidths.refs ? { width: colWidths.refs } : undefined}>
                  <span className="th-inner">
                    refs
                    <span
                      className="resize-handle"
                      role="separator"
                      aria-label="resize refs column"
                      onMouseDown={(e) => startResize("refs", e)}
                    />
                  </span>
                </th>
              )}
              {showFileColumn && (
                <th style={colWidths.file ? { width: colWidths.file } : undefined}>
                  <span className="th-inner">
                    file
                    <span
                      className="resize-handle"
                      role="separator"
                      aria-label="resize file column"
                      onMouseDown={(e) => startResize("file", e)}
                    />
                  </span>
                </th>
              )}
              <th className="title">
                <span className="th-inner">title</span>
              </th>
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {flatRows.length > 0 && start > 0 && (
              <tr style={{ height: start * ROW_HEIGHT }} aria-hidden="true">
                <td colSpan={100} />
              </tr>
            )}
            {flatRows.slice(start, end).map((row, offset) => {
              const index = start + offset;
              if (row.kind === "group") {
                const expanded = expandedGroups[row.key] ?? index === 0;
                return (
                  <tr
                    key={"g:" + row.key}
                    tabIndex={0}
                    ref={(el) => {
                      if (el) rowRefs.current.set(index, el);
                      else rowRefs.current.delete(index);
                    }}
                    className="group-header"
                    onClick={() => toggleGroup(row.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleGroup(row.key);
                      }
                    }}
                  >
                    <td className="marker">{expanded ? "▾" : "▸"}</td>
                    <td>
                      <ChangeId value={row.rep.change_id} />
                    </td>
                    {showRefsColumn && <td className="refs" />}
                    <td className="date">
                      {row.rep.timestamp !== null ? relative(row.rep.timestamp) : ""}
                    </td>
                    <td className="stat">
                      <Badge variant="secondary">{row.count} matches</Badge>
                    </td>
                    {showFileColumn && <td className="file" />}
                    <td className="title" title={row.rep.title}>
                      {row.rep.title}
                    </td>
                  </tr>
                );
              }
              const result = row.result;
              const stat = stats[result.commit_id];
              return (
                <tr
                  key={result.commit_id + result.title + index}
                  tabIndex={0}
                  aria-selected={index === selected}
                  className={`${index === selected ? "selected" : ""}${mode === "changes" ? " line-row" : ""}`}
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
                      setSelected(flatRows.length - 1);
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
                    <span className="row-actions">
                      <button
                        className="row-action"
                        aria-label={`copy change id ${result.change_id}`}
                        title="copy change id"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(result.change_id);
                        }}
                      >
                        ⧉ id
                      </button>
                      <button
                        className="row-action"
                        aria-label={`copy jj new ${result.change_id}`}
                        title="copy jj new command"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(`jj new ${result.change_id}`);
                        }}
                      >
                        ⧉ jj new
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {flatRows.length > 0 && (flatRows.length - end) * ROW_HEIGHT > 0 && (
              <tr style={{ height: (flatRows.length - end) * ROW_HEIGHT }} aria-hidden="true">
                <td colSpan={100} />
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </Splitter.Panel>
      <Splitter.ResizeTrigger id="list:detail" aria-label="resize panes" />
      <Splitter.Panel id="detail">
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
        <span>↑↓ navigate</span>
      </footer>
    </div>
  );
}
