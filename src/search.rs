use std::{
    fmt,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
    process::{Child, ChildStdout, Command, Stdio},
};

use anyhow::{Context, Result, bail};
use regex::{Regex, RegexBuilder};

use crate::{
    dates,
    fuzzy::{self},
};

const FIELD: char = '\u{1f}';
const RECORD: char = '\u{1e}';

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Mode {
    #[default]
    Metadata,
    Changes,
    Snapshot,
}

impl Mode {
    pub const ALL: [Mode; 3] = [Mode::Metadata, Mode::Changes, Mode::Snapshot];

    pub const fn name(self) -> &'static str {
        match self {
            Self::Metadata => "metadata",
            Self::Changes => "changes",
            Self::Snapshot => "snapshot",
        }
    }
}

impl std::str::FromStr for Mode {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self> {
        Mode::ALL
            .into_iter()
            .find(|mode| mode.name() == value)
            .context("unknown mode")
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum MatchMode {
    #[default]
    Literal,
    Regex,
    Fuzzy,
}

impl std::str::FromStr for MatchMode {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self> {
        match value {
            "literal" => Ok(Self::Literal),
            "regex" => Ok(Self::Regex),
            "fuzzy" => Ok(Self::Fuzzy),
            other => anyhow::bail!("unknown match mode '{other}'"),
        }
    }
}

#[derive(Clone, Debug)]
pub struct SearchRequest {
    pub query: String,
    pub mode: Mode,
    pub revset: Option<String>,
    pub path: Option<String>,
    /// Explicit date filters (unix seconds); combined with any prefixes found
    /// in the query itself.
    pub since: Option<i64>,
    pub until: Option<i64>,
    pub match_mode: MatchMode,
    pub repository: Option<PathBuf>,
    pub limit: usize,
}

impl Default for SearchRequest {
    fn default() -> Self {
        Self {
            query: String::new(),
            mode: Mode::default(),
            revset: None,
            path: None,
            since: None,
            until: None,
            match_mode: MatchMode::default(),
            repository: None,
            limit: 200,
        }
    }
}

#[derive(Clone, Debug)]
pub struct SearchResult {
    pub commit_id: String,
    pub change_id: String,
    pub title: String,
    pub bookmarks: Vec<String>,
    pub tags: Vec<String>,
    pub author: Option<String>,
    pub timestamp: Option<i64>,
    pub file: Option<String>,
    pub line: Option<usize>,
    pub detail: String,
}

impl SearchResult {
    pub fn labels(&self) -> impl Iterator<Item = &str> + '_ {
        self.bookmarks
            .iter()
            .chain(self.tags.iter())
            .map(String::as_str)
    }

    /// Human-readable single-line form for CLI output.
    pub fn display_line(&self) -> String {
        let labels = self.labels().collect::<Vec<_>>();
        let location = self.file.as_ref().map_or_else(String::new, |file| {
            format!(" {file}{}", self.line.map_or_else(String::new, |l| format!(":{l}")))
        });
        let mut line = format!("{} {}{} {}", self.commit_id, self.change_id, location, self.title);
        if !labels.is_empty() {
            line.push_str("  [");
            line.push_str(&labels.join(", "));
            line.push(']');
        }
        if let Some(timestamp) = self.timestamp {
            line.push_str("  (");
            line.push_str(&dates::relative(timestamp));
            line.push(')');
        }
        line
    }
}

/// Extract `after:`/`before:` (`since:`/`until:`) prefixes from a raw query.
/// Returns the cleaned query plus the parsed bounds.
pub fn extract_date_prefixes(query: &str) -> (String, Option<i64>, Option<i64>) {
    let mut cleaned = Vec::new();
    let mut since = None;
    let mut until = None;
    for token in query.split_whitespace() {
        let handled = 'handled: {
            for prefix in ["after:", "since:", "before:", "until:"] {
                if let Some(rest) = token.strip_prefix(prefix)
                    && let Some(timestamp) =
                        dates::parse_with_end(rest, prefix.starts_with("bef") || prefix.starts_with("unt"))
                    {
                        match prefix {
                            "after:" | "since:" => since = Some(timestamp),
                            _ => until = Some(timestamp),
                        }
                        break 'handled true;
                    }
            }
            false
        };
        if !handled {
            cleaned.push(token.to_owned());
        }
    }
    (cleaned.join(" "), since, until)
}

#[derive(Debug)]
pub struct SearchOutput {
    pub results: Vec<SearchResult>,
    /// True when more matches existed than `limit` allowed.
    pub truncated: bool,
}

impl SearchOutput {
    #[allow(dead_code)]
    pub fn empty() -> Self {
        Self { results: Vec::new(), truncated: false }
    }
}

pub fn search(request: &SearchRequest) -> Result<SearchOutput> {
    // Fold explicit CLI/TUI bounds together with query prefixes.
    let (cleaned_query, prefix_since, prefix_until) =
        extract_date_prefixes(&request.query);
    let request = SearchRequest {
        query: cleaned_query,
        since: request.since.or(prefix_since),
        until: request.until.or(prefix_until),
        ..request.clone()
    };
    let output = match request.mode {
        Mode::Metadata => search_metadata(&request)?,
        Mode::Changes => search_changes(&request)?,
        Mode::Snapshot => search_snapshot(&request)?,
    };
    Ok(output)
}

enum Matcher {
    Regex(Regex),
    Fuzzy { needle: String },
}

fn build_matcher(query: &str, mode: MatchMode) -> Result<Option<Matcher>> {
    if query.is_empty() {
        return Ok(None);
    }
    Ok(match mode {
        MatchMode::Literal => Some(Matcher::Regex(
            RegexBuilder::new(&regex::escape(query))
                .case_insensitive(true)
                .build()
                .context("could not build text matcher")?,
        )),
        MatchMode::Regex => Some(Matcher::Regex(Regex::new(query).context("invalid regular expression")?)),
        MatchMode::Fuzzy => Some(Matcher::Fuzzy { needle: query.to_lowercase() }),
    })
}

impl Matcher {
    fn is_match(&self, value: &str) -> bool {
        match self {
            Self::Regex(regex) => regex.is_match(value),
            Self::Fuzzy { needle } => fuzzy::fuzzy_match(value, needle).is_some(),
        }
    }
}

fn in_date_range(request: &SearchRequest, timestamp: Option<i64>) -> bool {
    let Some(timestamp) = timestamp else {
        return request.since.is_none() && request.until.is_none();
    };
    request.since.is_none_or(|since| timestamp >= since)
        && request.until.is_none_or(|until| timestamp <= until)
}

fn jj_command(request: &SearchRequest) -> Command {
    let mut command = Command::new("jj");
    command.arg("--ignore-working-copy");
    if let Some(repository) = &request.repository {
        command.args(["--repository", repository.to_string_lossy().as_ref()]);
    }
    command
}

fn spawn(mut command: Command) -> Result<Child> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    command.spawn().context("failed to start jj")
}

/// Translate raw jj stderr into actionable messages.
fn friendly_error(stderr: &str) -> String {
    let trimmed = stderr.trim().strip_prefix("Error: ").unwrap_or(stderr.trim()).trim();
    if trimmed.contains("doesn't exist")
        && let Some((_, rest)) = trimmed.split_once('`')
        && let Some((name, _)) = rest.split_once('`')
    {
        return format!(
            "unknown revision `{name}` — Tab to the revset field or Ctrl-B to pick a bookmark"
        );
    }
    if trimmed.contains("Failed to parse revset") || trimmed.contains("expected") {
        return format!("invalid revset: {}", trimmed.lines().next().unwrap_or(trimmed));
    }
    trimmed.to_owned()
}

fn ensure_success(child: Child) -> Result<()> {
    let output = child.wait_with_output().context("could not wait for jj")?;
    if output.status.success() {
        Ok(())
    } else {
        bail!("{}", friendly_error(&String::from_utf8_lossy(&output.stderr)))
    }
}

/// Abandon a streaming child early (result cap hit): close our end of the
/// pipe first so jj gets EPIPE instead of blocking on a full pipe, then reap.
fn abandon(reader: BufReader<ChildStdout>, mut child: Child) -> Result<()> {
    drop(reader);
    let _ = child.kill();
    child.wait().context("could not wait for jj")?;
    Ok(())
}

fn search_metadata(request: &SearchRequest) -> Result<SearchOutput> {
    let mut command = jj_command(request);
    command.args([
        "log",
        "--no-graph",
        "--revisions",
        request.revset.as_deref().unwrap_or("all()"),
        "--template",
        "commit_id ++ \"\\x1f\" ++ change_id.shortest(4) ++ \"\\x1f\" ++ description ++ \"\\x1f\" \
         ++ bookmarks.join(\",\") ++ \"\\x1f\" ++ tags.join(\",\") ++ \"\\x1f\" \
         ++ committer.timestamp().format(\"%s\") ++ \"\\x1f\" ++ author.email() ++ \"\\x1e\"",
    ]);
    if let Some(path) = &request.path {
        command.arg(path);
    }
    let matcher = build_matcher(&request.query, request.match_mode)?;
    let mut results = Vec::new();
    let mut truncated = false;
    let internal_limit = request.limit + 1;
    let mut child = spawn(command)?;
    let mut output = Vec::new();
    let mut reader = BufReader::new(child.stdout.take().expect("stdout is piped"));
    while reader.read_until(RECORD as u8, &mut output)? != 0 {
        let record = String::from_utf8_lossy(&output);
        let record = record.trim_end_matches(RECORD);
        let mut fields = record.split(FIELD);
        let (
            Some(commit_id),
            Some(change_id),
            Some(description),
            Some(bookmarks),
            Some(tags),
            Some(timestamp_raw),
        ) = (
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
        )
        else {
            output.clear();
            continue;
        };
        let author = fields.next();
        let timestamp: Option<i64> = timestamp_raw.parse().ok();
        let searchable = format!("{description}\n{bookmarks}\n{tags}");
        // Skip jj's virtual root commit (empty description, unix epoch).
        let is_placeholder = description.trim().is_empty()
            && timestamp.is_none_or(|ts| ts <= 0);
        let is_match = !is_placeholder
            && matcher.as_ref().is_none_or(|m| m.is_match(&searchable))
            && in_date_range(request, timestamp);
        if is_match {
            let title = description.lines().next().unwrap_or_default().to_owned();
            results.push(SearchResult {
                commit_id: commit_id.to_owned(),
                change_id: change_id.to_owned(),
                title,
                bookmarks: split_labels(bookmarks),
                tags: split_labels(tags),
                author: author.filter(|value| !value.is_empty()).map(str::to_owned),
                timestamp,
                file: None,
                line: None,
                detail: description.trim_end().to_owned(),
            });
            if results.len() == internal_limit {
                truncated = true;
                break;
            }
        }
        output.clear();
    }
    if truncated {
        abandon(reader, child)?;
    } else {
        ensure_success(child)?;
    }
    results.truncate(request.limit);
    Ok(SearchOutput { results, truncated })
}

fn split_labels(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect()
}

fn search_changes(request: &SearchRequest) -> Result<SearchOutput> {
    let matcher = build_matcher(&request.query, request.match_mode)?;
    let mut command = jj_command(request);
    command.args([
        "log",
        "--no-graph",
        "--revisions",
        request.revset.as_deref().unwrap_or("all()"),
        "--patch",
        "--git",
        "--template",
        "commit_id ++ \"\\x1f\" ++ change_id.shortest(4) ++ \"\\x1f\" ++ description.first_line() \
         ++ \"\\x1f\" ++ committer.timestamp().format(\"%s\") ++ \"\\x1f\" ++ author.email() ++ \"\\x1e\\n\"",
    ]);
    if let Some(path) = &request.path {
        command.arg(path);
    }
    let mut child = spawn(command)?;
    let mut reader = BufReader::new(child.stdout.take().expect("stdout is piped"));
    let mut results = Vec::new();
    let mut truncated = false;
    let internal_limit = request.limit + 1;
    let mut current_commit = String::new();
    let mut current_change = String::new();
    let mut current_title = String::new();
    let mut current_timestamp: Option<i64> = None;
    let mut revision_in_range = true;
    let mut file = None;
    let mut line = None;
    let mut buffer = String::new();
    while reader.read_line(&mut buffer)? != 0 {
        let raw = buffer.trim_end_matches(['\r', '\n']);
        if let Some(header) = raw.strip_suffix(RECORD) {
            let mut fields = header.split(FIELD);
            current_commit.clear();
            current_commit.push_str(fields.next().unwrap_or_default());
            current_change.clear();
            current_change.push_str(fields.next().unwrap_or_default());
            current_title.clear();
            current_title.push_str(fields.next().unwrap_or_default());
            current_timestamp = fields
                .next()
                .and_then(|value| value.parse().ok());
            revision_in_range = in_date_range(request, current_timestamp);
            file = None;
            line = None;
        } else if revision_in_range && let Some(path) = raw.strip_prefix("+++ b/") {
            file = Some(path.to_owned());
        } else if revision_in_range && raw.starts_with("@@ ") {
            line = hunk_start(raw);
        } else if revision_in_range && raw.starts_with('+') && !raw.starts_with("+++") {
            let content = &raw[1..];
            if matcher.as_ref().is_none_or(|m| m.is_match(content)) {
                push_line_result(
                    &mut results,
                    &current_commit,
                    &current_change,
                    &current_title,
                    current_timestamp,
                    file.as_deref(),
                    line,
                    content,
                );
                if results.len() == internal_limit {
                    truncated = true;
                    break;
                }
            }
            line = line.map(|value| value + 1);
        } else if revision_in_range && raw.starts_with(' ') {
            line = line.map(|value| value + 1);
        }
        buffer.clear();
    }
    if truncated {
        abandon(reader, child)?;
    } else {
        ensure_success(child)?;
    }
    results.truncate(request.limit);
    Ok(SearchOutput { results, truncated })
}

fn search_snapshot(request: &SearchRequest) -> Result<SearchOutput> {
    let matcher = build_matcher(&request.query, request.match_mode)?;
    let revision = request.revset.as_deref().unwrap_or("@");
    // Resolve the revision once so snapshot rows can carry ids.
    let (commit_id, change_id) = resolve_revision(request, revision)?;
    let mut list = jj_command(request);
    list.args(["file", "list", "--revision", revision]);
    if let Some(path) = &request.path {
        list.arg(path);
    }
    let mut list_child = spawn(list)?;
    let mut list_reader = BufReader::new(list_child.stdout.take().expect("stdout is piped"));
    let mut results = Vec::new();
    let mut truncated = false;
    let internal_limit = request.limit + 1;
    let mut path = String::new();
    while list_reader.read_line(&mut path)? != 0 {
        let path_line = path.trim_end_matches(['\r', '\n']);
        if !path_line.is_empty() {
            scan_snapshot_file(
                request,
                matcher.as_ref(),
                revision,
                &commit_id,
                &change_id,
                path_line,
                &mut results,
            )?;
            if results.len() >= internal_limit {
                truncated = true;
                break;
            }
        }
        path = String::new();
    }
    if truncated {
        abandon(list_reader, list_child)?;
    } else {
        ensure_success(list_child)?;
    }
    results.truncate(request.limit);
    Ok(SearchOutput { results, truncated })
}

fn resolve_revision(request: &SearchRequest, revision: &str) -> Result<(String, String)> {
    let mut command = jj_command(request);
    command.args([
        "log",
        "-r",
        revision,
        "--no-graph",
        "-T",
        "commit_id ++ \"\\x1f\" ++ change_id.shortest(4)",
    ]);
    let mut child = spawn(command)?;
    let stdout = child.stdout.take().expect("stdout is piped");
    let mut text = String::new();
    BufReader::new(stdout).read_to_string(&mut text)?;
    ensure_success(child)?;
    let text = text.trim();
    anyhow::ensure!(
        !text.is_empty(),
        "revset `{revision}` did not resolve to a revision"
    );
    let (commit_id, change_id) = text
        .split_once(FIELD)
        .context("could not parse revision ids")?;
    Ok((commit_id.to_owned(), change_id.to_owned()))
}

fn scan_snapshot_file(
    request: &SearchRequest,
    matcher: Option<&Matcher>,
    revision: &str,
    commit_id: &str,
    change_id: &str,
    path: &str,
    results: &mut Vec<SearchResult>,
) -> Result<()> {
    let mut command = jj_command(request);
    command.args(["file", "show", "--revision", revision, path]);
    let mut child = spawn(command)?;
    let mut reader = BufReader::new(child.stdout.take().expect("stdout is piped"));
    let mut source_line = 0_usize;
    let mut content = String::new();
    while reader.read_line(&mut content)? != 0 {
        source_line += 1;
        let content_line = content.trim_end_matches(['\r', '\n']);
        if matcher.is_none_or(|m| m.is_match(content_line)) {
            push_line_result(
                results,
                commit_id,
                change_id,
                path,
                None,
                Some(path),
                Some(source_line),
                content_line,
            );
            content.clear();
            continue;
        }
        content = String::new();
    }
    ensure_success(child)
}

#[allow(clippy::too_many_arguments)]
fn push_line_result(
    results: &mut Vec<SearchResult>,
    commit_id: &str,
    change_id: &str,
    title: &str,
    timestamp: Option<i64>,
    file: Option<&str>,
    line: Option<usize>,
    detail: &str,
) {
    results.push(SearchResult {
        commit_id: commit_id.to_owned(),
        change_id: change_id.to_owned(),
        title: title.to_owned(),
        bookmarks: Vec::new(),
        tags: Vec::new(),
        author: None,
        timestamp,
        file: file.map(str::to_owned),
        line,
        detail: detail.to_owned(),
    });
}

fn hunk_start(header: &str) -> Option<usize> {
    let plus = header
        .split_whitespace()
        .find(|part| part.starts_with('+'))?;
    plus[1..].split(',').next()?.parse().ok()
}

/// JSON serialization without pulling serde.
pub fn to_json(output: &SearchOutput) -> String {
    let items = output
        .results
        .iter()
        .map(|result| {
            format!(
                "{{\"commit_id\":\"{}\",\"change_id\":\"{}\",\"title\":{},\"detail\":{},\
                 \"bookmarks\":{},\"tags\":{},\"author\":{},\"timestamp\":{},\
                 \"file\":{},\"line\":{}}}",
                json_escape(&result.commit_id),
                json_escape(&result.change_id),
                json_string(&result.title),
                json_string(&result.detail),
                json_array(&result.bookmarks),
                json_array(&result.tags),
                result.author.as_ref().map_or("null".to_owned(), |author| json_string(author)),
                result.timestamp.map_or("null".to_owned(), |ts| ts.to_string()),
                result.file.as_ref().map_or("null".to_owned(), |file| json_string(file)),
                result.line.map_or("null".to_owned(), |line| line.to_string()),
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    format!("{{\"truncated\":{},\"matches\":{},\"results\":[{}]}}", output.truncated, output.results.len(), items)
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn json_string(value: &str) -> String {
    format!("\"{}\"", json_escape(value))
}

fn json_array(values: &[String]) -> String {
    format!(
        "[{}]",
        values.iter().map(|v| json_string(v)).collect::<Vec<_>>().join(",")
    )
}

impl fmt::Display for SearchResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display_line())?;
        if !self.detail.is_empty() && self.detail != self.title {
            write!(f, "\n  {}", self.detail)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_queries_are_literal_and_case_insensitive() {
        let matcher = build_matcher("fix [api]", MatchMode::Literal).unwrap();
        assert!(matcher.unwrap().is_match("Fix [API] response"));
    }

    #[test]
    fn regex_queries_keep_their_meaning() {
        let matcher = build_matcher("fix (api|cli)", MatchMode::Regex).unwrap();
        assert!(matcher.unwrap().is_match("fix api"));
        assert!(!build_matcher("fix (api|cli)", MatchMode::Regex)
            .unwrap()
            .unwrap()
            .is_match("fix UI"));
    }

    #[test]
    fn reads_new_file_line_from_a_diff_hunk() {
        assert_eq!(hunk_start("@@ -5,3 +12,8 @@"), Some(12));
        assert_eq!(hunk_start("@@ -0,0 +1 @@"), Some(1));
    }

    #[test]
    fn extracts_date_prefixes_from_query() {
        let (query, since, until) = extract_date_prefixes("after:2026-08-01 before:2w error");
        assert_eq!(query, "error");
        assert!(since.is_some());
        assert!(until.is_some());
        assert_eq!(dates::parse("2026-08-01"), since);
    }

    #[test]
    fn date_range_bounds_are_inclusive_of_the_until_day() {
        let request = SearchRequest {
            since: Some(1000),
            until: Some(2000),
            ..SearchRequest::default()
        };
        assert!(!in_date_range(&request, Some(999)));
        assert!(in_date_range(&request, Some(1000)));
        assert!(in_date_range(&request, Some(2000)));
        assert!(!in_date_range(&request, Some(2000 + 86_400)));
    }

    #[test]
    fn json_output_round_trips_basic_fields() {
        let output = SearchOutput {
            results: vec![SearchResult {
                commit_id: "abc".into(),
                change_id: "xyz".into(),
                title: "fix \"quotes\"".into(),
                detail: "body\nlines".into(),
                bookmarks: vec!["main".into()],
                tags: vec![],
                author: Some("a@b.c".into()),
                timestamp: Some(123),
                file: None,
                line: None,
            }],
            truncated: false,
        };
        let json = to_json(&output);
        assert!(json.contains("\"truncated\":false"));
        assert!(json.contains("\\\"quotes\\\""));
        assert!(json.contains("[\"main\"]"));
    }
}
