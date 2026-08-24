//! `itwas web` — serves the pre-built kumo-ui/Vite frontend plus a small JSON
//! API exposing everything the CLI can do. std-only HTTP; no web framework.

use std::{
    collections::{HashMap, VecDeque},
    io::{BufRead, BufReader, Write},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    process::Command,
    sync::{Mutex, OnceLock},
};

use anyhow::{Context as _, Result};
use include_dir::{include_dir, Dir};

use crate::search::{self, MatchMode, SearchRequest};

static WEB_DIST: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/assets/web");

const DEFAULT_PORT: u16 = 7878;
const CACHE_CAPACITY: usize = 64;

/// Insertion-order-evicting cache. Not LRU: a `get` does not refresh order,
/// which keeps the implementation lock-simple and is fine for our use.
struct FifoCache {
    entries: Mutex<HashMap<String, String>>,
    order: Mutex<VecDeque<String>>,
}

impl FifoCache {
    fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            order: Mutex::new(VecDeque::new()),
        }
    }

    fn get(&self, key: &str) -> Option<String> {
        self.entries.lock().expect("cache lock").get(key).cloned()
    }

    fn insert(&self, key: String, value: String) {
        let mut entries = self.entries.lock().expect("cache lock");
        let mut order = self.order.lock().expect("cache order lock");
        if !entries.contains_key(&key) {
            order.push_back(key.clone());
            while order.len() > CACHE_CAPACITY {
                let Some(evicted) = order.pop_front() else {
                    break;
                };
                entries.remove(&evicted);
            }
        }
        entries.insert(key, value);
    }
}

fn diff_cache() -> &'static FifoCache {
    static CACHE: OnceLock<FifoCache> = OnceLock::new();
    CACHE.get_or_init(FifoCache::new)
}

fn stats_cache() -> &'static FifoCache {
    static CACHE: OnceLock<FifoCache> = OnceLock::new();
    CACHE.get_or_init(FifoCache::new)
}

/// Cache keys must be scoped per repository.
fn cache_key(repository: Option<&PathBuf>, rest: &str) -> String {
    format!(
        "{}\u{1f}{rest}",
        repository.map_or_else(String::new, |path| path.display().to_string())
    )
}

/// anyhow's top-level Display can embed jj's own "Error: " prefix; strip it so
/// JSON consumers never see doubled prefixes.
fn clean_error_text(text: &str) -> String {
    text.trim()
        .strip_prefix("Error: ")
        .unwrap_or(text.trim())
        .to_owned()
}

/// Parse `itwas web [-p|--port N] [-R|--repository PATH]` arguments.
pub fn run_from_args(args: impl Iterator<Item = String>) -> Result<()> {
    let mut port = None;
    let mut repository = None;
    let mut rest = args.peekable();
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--port" | "-p" => {
                port = rest.next().and_then(|value| value.parse().ok());
            }
            "--repository" | "-R" => {
                repository = rest.next().map(PathBuf::from);
            }
            other => anyhow::bail!("unknown argument '{other}' (usage: itwas web [-p PORT] [-R REPO])"),
        }
    }
    run(repository, port)
}

#[allow(clippy::needless_pass_by_value)]
pub fn run(repository: Option<PathBuf>, port: impl Into<Option<u16>>) -> Result<()> {
    crate::dates::init();
    let port = port.into().unwrap_or(DEFAULT_PORT);
    let listener = TcpListener::bind(("127.0.0.1", port))
        .with_context(|| format!("could not bind 127.0.0.1:{port}"))?;
    let url = format!("http://127.0.0.1:{port}");
    println!("itwas web serving on {url}");
    println!("Ctrl-C to stop");
    open_browser(&url);
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let repository = repository.clone();
                std::thread::spawn(move || {
                    if let Err(error) = handle_connection(stream, repository) {
                        eprintln!("request failed: {error:#}");
                    }
                });
            }
            Err(error) => eprintln!("connection error: {error}"),
        }
    }
    Ok(())
}

/// Best-effort launch of the system browser.
#[allow(unused_variables)]
fn open_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result =
        Command::new("xdg-open").arg(url).stdout(Stdio::null()).stderr(Stdio::null()).spawn();
    #[cfg(windows)]
    let result = Command::new("cmd").args(["/C", "start", url]).spawn();
    if let Err(error) = result {
        println!("could not open a browser ({error}); visit {url} manually");
    }
}

fn handle_connection(stream: TcpStream, repository: Option<PathBuf>) -> Result<()> {
    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    // Drain headers (we only need them gone before the next keep-alive parse;
    // we always answer with Connection: close).
    loop {
        let mut line = String::new();
        reader.read_line(&mut line)?;
        if line == "\r\n" || line.is_empty() {
            break;
        }
    }

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_owned();
    let target = parts.next().unwrap_or_default().to_owned();
    let (path, query) = match target.split_once('?') {
        Some((path, query)) => (path.to_owned(), query.to_owned()),
        None => (target.clone(), String::new()),
    };
    let params: Vec<(String, String)> = query
        .split('&')
        .filter(|piece| !piece.is_empty())
        .map(|piece| match piece.split_once('=') {
            Some((key, value)) => (url_decode(key), url_decode(value)),
            None => (url_decode(piece), String::new()),
        })
        .collect();

    let (status, content_type, body, extra_headers) = if path == "/api/diff" {
        api_diff(&params, repository)
    } else {
        route(&method, &path, &params, repository)
    };
    respond(stream, status, content_type, body, &extra_headers)
}

type Response = (u16, &'static str, Vec<u8>, Vec<(&'static str, String)>);

fn route(
    method: &str,
    path: &str,
    params: &[(String, String)],
    repository: Option<PathBuf>,
) -> Response {
    if method != "GET" && method != "HEAD" {
        return json_response(405, br#"{"error":"method not allowed"}"#.to_vec());
    }
    match path {
        "/api/search" => api_search(params, repository),
        "/api/bookmarks" => match crate::actions::list_bookmarks(repository.as_deref()) {
            Ok(names) => json_response(200, format!("[{}]", names.iter().map(|name| json_string(name)).collect::<Vec<_>>().join(",")).into_bytes()),
            Err(error) => json_error(500, &clean_error_text(&format!("{error:#}"))),
        },
        "/api/related" => {
            let Some(commit) = param(params, "commit") else {
                return json_error(400, "missing commit");
            };
            match crate::actions::fetch_related(repository.as_deref(), &commit) {
                Ok(related) => {
                    let items = related
                        .iter()
                        .map(|change| {
                            format!(
                                "{{\"relation\":{},\"change_id\":{},\"timestamp\":{},\"title\":{}}}",
                                json_string(change.relation),
                                json_string(&change.change_id),
                                change.timestamp.map_or("null".to_owned(), |ts| ts.to_string()),
                                json_string(&change.title),
                            )
                        })
                        .collect::<Vec<_>>()
                        .join(",");
                    json_response(200, format!("[{items}]").into_bytes())
                }
                Err(error) => json_error(500, &clean_error_text(&format!("{error:#}"))),
            }
        }
        "/api/stats" => {
            let Some(commits) = param(params, "commits") else {
                return json_error(400, "missing commits");
            };
            let key = cache_key(repository.as_ref(), &commits);
            if let Some(cached) = stats_cache().get(&key) {
                return json_response(200, cached.into_bytes());
            }
            let mut batch = String::from("{");
            for commit in commits.split(',').filter(|c| !c.is_empty()) {
                if let Some(stat) =
                    crate::actions::fetch_diffstat(repository.as_deref(), commit)
                {
                    if !batch.ends_with('{') {
                        batch.push(',');
                    }
                    batch.push_str(&json_string(commit));
                    batch.push_str(":{\"added\":");
                    batch.push_str(&stat.added.to_string());
                    batch.push_str(",\"removed\":");
                    batch.push_str(&stat.removed.to_string());
                    batch.push('}');
                }
            }
            batch.push('}');
            stats_cache().insert(key, batch.clone());
            json_response(200, batch.into_bytes())
        }
        "/api/diffstat" => {
            let Some(commit) = param(params, "commit") else {
                return json_error(400, "missing commit");
            };
            let stat = crate::actions::fetch_diffstat(repository.as_deref(), &commit);
            json_response(
                200,
                match stat {
                    Some(stat) => format!(
                        "{{\"added\":{},\"removed\":{}}}",
                        stat.added, stat.removed
                    )
                    .into_bytes(),
                    None => b"null".to_vec(),
                },
            )
        }
        "/api/meta" => json_response(
            200,
            format!(
                "{{\"version\":\"{}\",\"repository\":{}}}",
                env!("CARGO_PKG_VERSION"),
                repository
                    .as_ref()
                    .map_or("null".to_owned(), |path| json_string(&path.display().to_string()))
            )
            .into_bytes(),
        ),
        _ => serve_static(path),
    }
}

/// `/api/diff` handled outside `route` because it carries the X-Cache header.
#[allow(clippy::needless_pass_by_value)] // mirrors route's signature
fn api_diff(params: &[(String, String)], repository: Option<PathBuf>) -> Response {
    let Some(commit) = param(params, "commit") else {
        return json_error(400, "missing commit");
    };
    let key = cache_key(repository.as_ref(), &commit);
    if let Some(cached) = diff_cache().get(&key) {
        return (
            200,
            "text/plain; charset=utf-8",
            cached.into_bytes(),
            vec![("X-Cache", "HIT".to_owned())],
        );
    }
    match crate::actions::fetch_full_diff(repository.as_deref(), &commit) {
        Ok(diff) => {
            diff_cache().insert(key, diff.clone());
            (
                200,
                "text/plain; charset=utf-8",
                diff.into_bytes(),
                vec![("X-Cache", "MISS".to_owned())],
            )
        }
        Err(error) => json_error(500, &clean_error_text(&format!("{error:#}"))),
    }
}

fn api_search(params: &[(String, String)], repository: Option<PathBuf>) -> Response {
    let get = |key: &str| param(params, key);
    let request = SearchRequest {
        // The UI sends "q"; keep accepting "query" for API compatibility.
        query: get("q").or_else(|| get("query")).unwrap_or_default(),
        mode: get("mode").and_then(|value| value.parse().ok()).unwrap_or_default(),
        revset: get("revset").filter(|value| !value.is_empty()),
        path: get("path").filter(|value| !value.is_empty()),
        since: get("since").and_then(|value| crate::dates::parse(&value)),
        until: get("until")
            .and_then(|value| crate::dates::parse_with_end(&value, true)),
        match_mode: get("match")
            .and_then(|value| value.parse::<MatchMode>().ok())
            .unwrap_or_default(),
        limit: get("limit").and_then(|value| value.parse().ok()).unwrap_or(200),
        repository,
    };
    match search::search(&request) {
        Ok(output) => json_response(200, search::to_json(&output).into_bytes()),
        Err(error) => json_error(400, &clean_error_text(&format!("{error:#}"))),
    }
}

fn param(params: &[(String, String)], key: &str) -> Option<String> {
    params
        .iter()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value.clone())
}

#[allow(clippy::match_same_arms)]
fn content_type_for(extension: Option<&str>) -> &'static str {
    match extension {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn serve_static(path: &str) -> Response {
    let trimmed = path.trim_start_matches('/');
    let file_path = if trimmed.is_empty() { "index.html" } else { trimmed };
    let file = WEB_DIST
        .get_file(file_path)
        .or_else(|| WEB_DIST.get_file("index.html")); // SPA fallback
    match file {
        Some(file) => {
            let extension = file.path().extension().and_then(|ext| ext.to_str());
            (
                200,
                content_type_for(extension),
                file.contents().to_vec(),
                Vec::new(),
            )
        }
        None => (
            404,
            "text/plain; charset=utf-8",
            b"web assets not embedded - run: cd apps/web && npm install && npm run build"
                .to_vec(),
            Vec::new(),
        ),
    }
}

fn json_response(status: u16, body: Vec<u8>) -> Response {
    (status, "application/json", body, Vec::new())
}

fn json_error(status: u16, message: &str) -> Response {
    json_response(status, format!("{{\"error\":{}}}", json_string(message)).into_bytes())
}

/// Minimal JSON string escaping shared with search output.
fn json_string(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t");
    format!("\"{escaped}\"")
}

fn url_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                if let Ok(byte) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                    out.push(byte);
                    index += 3;
                } else {
                    out.push(b'%');
                    index += 1;
                }
            }
            b'+' => {
                out.push(b' ');
                index += 1;
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[allow(clippy::needless_pass_by_value)] // takes ownership for a single flush
fn respond(
    mut stream: TcpStream,
    status: u16,
    content_type: &str,
    body: Vec<u8>,
    extra_headers: &[(&'static str, String)],
) -> Result<()> {
    #[allow(clippy::match_same_arms)]
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "OK",
    };
    let mut header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\n",
        body.len()
    );
    for (name, value) in extra_headers {
        header.push_str(name);
        header.push_str(": ");
        header.push_str(value);
        header.push_str("\r\n");
    }
    header.push_str("Connection: close\r\n\r\n");
    stream.write_all(header.as_bytes())?;
    stream.write_all(&body)?;
    stream.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_returns_inserted_value() {
        let cache = FifoCache::new();
        assert_eq!(cache.get("k"), None);
        cache.insert("k".to_owned(), "v".to_owned());
        assert_eq!(cache.get("k"), Some("v".to_owned()));
    }

    #[test]
    fn cache_evicts_in_insertion_order_at_capacity() {
        let cache = FifoCache::new();
        for index in 0..CACHE_CAPACITY as u32 {
            cache.insert(format!("key{index}"), format!("value{index}"));
        }
        // Inserting one more evicts the OLDEST entry (insertion order, not LRU).
        cache.insert("overflow".to_owned(), "newest".to_owned());
        let oldest = format!("key{}", 0);
        let newest = format!("key{}", CACHE_CAPACITY as u32 - 1);
        assert_eq!(cache.get(&oldest), None, "oldest must be evicted");
        assert_eq!(cache.get(&newest), Some(format!("value{}", CACHE_CAPACITY as u32 - 1)));
        assert_eq!(cache.get("overflow"), Some("newest".to_owned()));
    }

    #[test]
    fn reinserting_updates_value_but_keeps_fifo_priority() {
        let cache = FifoCache::new();
        for index in 0..CACHE_CAPACITY as u32 {
            cache.insert(format!("key{index}"), format!("value{index}"));
        }
        // Refresh key0: value updates, but its eviction slot stays oldest.
        cache.insert("key0".to_owned(), "updated".to_owned());
        assert_eq!(cache.get("key0"), Some("updated".to_owned()));
        // One more insert evicts key0 (oldest slot), NOT the refreshed value's
        // recency -- this cache is FIFO, deliberately not LRU.
        cache.insert("overflow".to_owned(), "newest".to_owned());
        assert_eq!(cache.get("key0"), None);
        assert_eq!(cache.get("overflow"), Some("newest".to_owned()));
    }

    #[test]
    fn clean_error_strips_doubled_prefix() {
        assert_eq!(clean_error_text("Error: Revision `u` is ambiguous"), "Revision `u` is ambiguous");
        assert_eq!(clean_error_text("plain message"), "plain message");
        assert_eq!(clean_error_text(""), "");
    }
}
