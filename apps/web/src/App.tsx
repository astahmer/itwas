import { useEffect, useMemo, useRef, useState } from "react";
// NOTE: kumo-ui's published bundle embeds its own React (crashes hooks when
// mixed with ours), so we reuse only its stylesheet + classnames
// (.button/.primary/.secondary/.input/.label/.error).
import "kumo-ui/styles.css";
import { PatchDiff } from "@pierre/diffs/react";
import "./app.css";

type Mode = "metadata" | "changes" | "snapshot";
type MatchMode = "literal" | "regex" | "fuzzy";

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
const DATE_HINT =
  "YYYY-MM-DD · YYYY-MM-DD HH:MM · 30m/12h/2d/3w · today/yesterday/now";

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

function Diff({ commit }: { commit: string }) {
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
  if (diff === null) return <div className="spinner-small" />;

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
            options={{ theme: "pierre-dark" }}
          />
        ))}
      </>
    );
  }
  const lines = filterPatch(diff, filter);
  return (
    <>
      <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} />
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

const VALID_MODES: Mode[] = LANES;
const VALID_MATCHES: MatchMode[] = MATCH_MODES;

/** Initial filter state from the URL so ?q=…&revset=… links are shareable. */
function stateFromUrl(): {
  query: string;
  revset: string;
  path: string;
  after: string;
  until: string;
  mode: Mode;
  matchMode: MatchMode;
} {
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode") as Mode | null;
  const matchParam = params.get("match") as MatchMode | null;
  return {
    query: params.get("q") ?? "",
    revset: params.get("revset") ?? "",
    path: params.get("path") ?? "",
    after: params.get("after") ?? "",
    until: params.get("until") ?? "",
    mode: modeParam && VALID_MODES.includes(modeParam) ? modeParam : "metadata",
    matchMode:
      matchParam && VALID_MATCHES.includes(matchParam) ? matchParam : "literal",
  };
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
    <span className="segmented">
      {values.map((candidate) => (
        <button
          key={candidate}
          className={`button ${candidate === value ? "primary" : "secondary"}`}
          onClick={() => onChange(candidate)}
        >
          {candidate}
        </button>
      ))}
    </span>
  );
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
  const [limit, setLimit] = useState(200);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [stats, setStats] = useState<Record<string, { added: number; removed: number }>>({});
  const debounceRef = useRef<number | undefined>(undefined);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (mode !== "metadata") p.set("mode", mode);
    if (matchMode !== "literal") p.set("match", matchMode);
    if (revset.trim()) p.set("revset", revset.trim());
    if (path.trim()) p.set("path", path.trim());
    if (after.trim()) p.set("after", after.trim());
    if (until.trim()) p.set("until", until.trim());
    return p.toString();
  }, [query, revset, path, after, until, mode, matchMode]);

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
          setSelected(0);
        })
        .catch((e) => setError(String(e)));
    }, 150);
    return () => window.clearTimeout(debounceRef.current);
  }, [params, limit]);

  // Batch-fetch diff stats for visible results.
  useEffect(() => {
    const missing = (data?.results ?? [])
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

  const selectedResult = data?.results[selected];
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
      </header>

      <section className="controls">
        <label>
          <span className="label">query</span>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="type to search"
            autoFocus
          />
        </label>
        <label>
          <span className="label">revset</span>
          <input
            className="input"
            value={revset}
            onChange={(e) => setRevset(e.target.value)}
            placeholder="all()"
          />
        </label>
        <label>
          <span className="label">path</span>
          <input
            className="input"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="any"
          />
        </label>
        <label>
          <span className="label">after</span>
          <input
            className="input"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            placeholder={DATE_HINT}
          />
        </label>
        <label>
          <span className="label">until</span>
          <input
            className="input"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <Segmented values={LANES} value={mode} onChange={setMode} />
        <Segmented values={MATCH_MODES} value={matchMode} onChange={setMatchMode} />
      </section>

      {error && <div className="error banner">{error}</div>}

      <main>
        <table className="results">
          <thead>
            <tr>
              <th />
              <th>change</th>
              <th>refs</th>
              <th>date</th>
              <th>stats</th>
              <th>file</th>
              <th>title</th>
            </tr>
          </thead>
          <tbody>
            {(data?.results ?? []).map((result, index) => {
              const stat = stats[result.commit_id];
              return (
                <tr
                  key={result.commit_id + result.title + index}
                  className={index === selected ? "selected" : ""}
                  onClick={() => setSelected(index)}
                >
                  <td className="marker">{index === selected ? "›" : ""}</td>
                  <td>
                    <ChangeId value={result.change_id} />
                  </td>
                  <td className="refs">
                    {result.bookmarks.map((b) => (
                      <span key={b} className={`bookmark ${["main", "master", "trunk"].includes(b) ? "primary-ref" : ""}`}>
                        {b}
                      </span>
                    ))}
                    {result.tags.map((t) => (
                      <span key={t} className="tag-ref">tag:{t}</span>
                    ))}
                  </td>
                  <td className="date">
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
                  <td className="file">
                    {result.file
                      ? `${result.file}${result.line !== null ? `:${result.line}` : ""}`
                      : ""}
                  </td>
                  <td className="title">{result.title}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {selectedResult && (
          <aside className="detail">
            <div className="detail-head">
              <ChangeId value={selectedResult.change_id} />
              <button
                className="button secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(selectedResult.change_id)
                }
              >
                copy id
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `jj new ${selectedResult.change_id}`,
                  )
                }
              >
                copy jj new
              </button>
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
            <Diff commit={selectedResult.commit_id} />
          </aside>
        )}
      </main>

      <footer>
        <button className="button third" onClick={() => window.location.reload()}>
          refresh
        </button>
        <span>everything the CLI does — no terminal required</span>
      </footer>
    </div>
  );
}
