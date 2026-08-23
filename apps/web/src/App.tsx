import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
// NOTE: kumo-ui's published bundle embeds its own React, which crashes hooks
// ("Cannot read properties of null (reading 'useState')") when mixed with ours.
// We therefore reuse only its stylesheet and render the equivalent markup
// (.button/.primary/.secondary/.input/.label/.spinner-small classes) ourselves.
import "kumo-ui/styles.css";
import "./app.css";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-wrapper">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

function Loader() {
  return <div className="loader-small"><div className="spinner-small" /></div>;
}

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

interface RelatedChange {
  relation: "parent" | "child";
  change_id: string;
  timestamp: number | null;
  title: string;
}

interface SearchResponse {
  truncated: boolean;
  matches: number;
  results: SearchResult[];
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
  const units: [number, string][] = [
    [60, "just now"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2592000, "week"],
    [31536000, "month"],
  ];
  if (delta < 0) return "in the future";
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)} minute(s) ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} hour(s) ago`;
  if (delta < 604800) return `${Math.floor(delta / 86400)} day(s) ago`;
  if (delta < 2592000) return `${Math.floor(delta / 604800)} week(s) ago`;
  if (delta < 31536000) return `${Math.floor(delta / 2592000)} month(s) ago`;
  return `${Math.floor(delta / 31536000)} year(s) ago`;
}

function absolute(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  if (related === null) return <Loader />;
  if (related.length === 0) return null;
  return (
    <div>
      {related.map((change) => (
        <div key={change.relation + change.change_id} className="related-row">
          <span className={`relation ${change.relation}`}>
            [{change.relation}]
          </span>
          <span
            className="change-id"
            style={{ color: `hsl(${hashHue(change.change_id)}, 85%, 62%)` }}
          >
            {change.change_id}
          </span>
          {change.timestamp !== null && (
            <span className="date">{relative(change.timestamp)}</span>
          )}
          <span>{change.title}</span>
        </div>
      ))}
    </div>
  );
}

function Diff({ commit }: { commit: string }) {
  const [diff, setDiff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDiff(null);
    setError(null);
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
  return (
    <pre className="diff">
      {diff.split("\n").map((line, i) => (
        <div
          key={i}
          className={
            line.startsWith("+") && !line.startsWith("+++")
              ? "add"
              : line.startsWith("-") && !line.startsWith("---")
                ? "del"
                : line.startsWith("@@")
                  ? "hunk"
                  : undefined
          }
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [revset, setRevset] = useState("");
  const [path, setPath] = useState("");
  const [after, setAfter] = useState("");
  const [until, setUntil] = useState("");
  const [mode, setMode] = useState<Mode>("metadata");
  const [matchMode, setMatchMode] = useState<MatchMode>("literal");
  const [limit, setLimit] = useState(200);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [stats, setStats] = useState<Record<string, { added: number; removed: number }>>({});
  const debounceRef = useRef<number | undefined>(undefined);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("query", query);
    p.set("mode", mode);
    p.set("match", matchMode);
    p.set("limit", String(limit));
    if (revset.trim()) p.set("revset", revset.trim());
    if (path.trim()) p.set("path", path.trim());
    if (after.trim()) p.set("since", after.trim());
    if (until.trim()) p.set("until", until.trim());
    return p.toString();
  }, [query, revset, path, after, until, mode, matchMode, limit]);

  // Search immediately on mount and on every debounced change.
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/search?${params}`)
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
  }, [params]);

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
        <Field label="query">
          <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="type to search" autoFocus />
        </Field>
        <Field label="revset">
          <TextField value={revset} onChange={(e) => setRevset(e.target.value)} placeholder="all()" />
        </Field>
        <Field label="path">
          <TextField value={path} onChange={(e) => setPath(e.target.value)} placeholder="any" />
        </Field>
        <Field label="after">
          <TextField value={after} onChange={(e) => setAfter(e.target.value)} placeholder={DATE_HINT} />
        </Field>
        <Field label="until">
          <TextField value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        <div className="toggles">
          <div className="segmented">
            {LANES.map((lane) => (
              <button key={lane} className={lane === mode ? "active" : ""} onClick={() => setMode(lane)}>
                {lane}
              </button>
            ))}
          </div>
          <div className="segmented">
            {MATCH_MODES.map((m) => (
              <button key={m} className={m === matchMode ? "active" : ""} onClick={() => setMatchMode(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <div className="error banner">{error}</div>}

      <main>
        <ul className="results">
          {(data?.results ?? []).map((result, index) => {
            const stat = stats[result.commit_id];
            return (
              <li
                key={result.commit_id + result.title + index}
                className={index === selected ? "selected" : ""}
                onClick={() => setSelected(index)}
              >
                <span className="marker">{index === selected ? "›" : ""}</span>
                <span className="change-id" style={{ color: `hsl(${hashHue(result.change_id)}, 85%, 62%)` }}>
                  {result.change_id}
                </span>
                {result.bookmarks.map((b) => (
                  <span key={b} className={`bookmark ${["main", "master", "trunk"].includes(b) ? "primary" : ""}`}>
                    {b}
                  </span>
                ))}
                {result.tags.map((t) => (
                  <span key={t} className="tag">tag:{t}</span>
                ))}
                {result.timestamp !== null && (
                  <span className="date">{relative(result.timestamp)}</span>
                )}
                {stat && (stat.added > 0 || stat.removed > 0) && (
                  <span className="stat">
                    <span className="added">+{stat.added}</span>{" "}
                    <span className="removed">−{stat.removed}</span>
                  </span>
                )}
                {result.file && (
                  <span className="file">
                    {result.file}
                    {result.line !== null ? `:${result.line}` : ""}
                  </span>
                )}
                <span className="title">{result.title}</span>
              </li>
            );
          })}
        </ul>

        {selectedResult && (
          <aside className="detail">
            <div className="detail-head">
              <span className="change-id" style={{ color: `hsl(${hashHue(selectedResult.change_id)}, 85%, 62%)` }}>
                {selectedResult.change_id}
              </span>
              <button
                className="button secondary"
                onClick={() => navigator.clipboard?.writeText(selectedResult.change_id)}
              >
                copy id
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(`jj new ${selectedResult.change_id}`)
                }
              >
                copy jj new
              </button>
              {selectedResult.author && <span className="author">{selectedResult.author}</span>}
              {selectedResult.timestamp !== null && (
                <span className="date">{absolute(selectedResult.timestamp)}</span>
              )}
            </div>
            {selectedResult.detail.split("\n").slice(1).length > 0 && (
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
