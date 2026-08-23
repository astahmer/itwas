use std::{
    fmt,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
};

use anyhow::{Context, Result, bail};
use regex::{Regex, RegexBuilder};

const FIELD: char = '\u{1f}';
const RECORD: char = '\u{1e}';

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Mode {
    #[default]
    Metadata,
    Changes,
    Snapshot,
}

#[derive(Clone, Debug)]
pub struct SearchRequest {
    pub query: String,
    pub mode: Mode,
    pub revset: Option<String>,
    pub path: Option<String>,
    pub regex: bool,
    pub repository: Option<PathBuf>,
    pub limit: usize,
}

#[derive(Clone, Debug)]
pub struct SearchResult {
    pub revision: String,
    pub change_id: String,
    pub title: String,
    pub labels: String,
    pub file: Option<String>,
    pub line: Option<usize>,
    pub detail: String,
}

impl fmt::Display for SearchResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let labels = (!self.labels.is_empty()).then(|| format!(" [{0}]", self.labels));
        let location = self.file.as_ref().map_or_else(String::new, |file| {
            let line = self
                .line
                .map_or_else(String::new, |line| format!(":{line}"));
            format!(" {file}{line}")
        });
        write!(
            f,
            "{} {}{} {}{}",
            self.revision,
            self.change_id,
            location,
            self.title,
            labels.unwrap_or_default()
        )?;
        if self.detail != self.title {
            write!(f, "\n  {}", self.detail)?;
        }
        Ok(())
    }
}

pub fn search(request: &SearchRequest) -> Result<Vec<SearchResult>> {
    match request.mode {
        Mode::Metadata => search_metadata(request),
        Mode::Changes => search_changes(request),
        Mode::Snapshot => search_snapshot(request),
    }
}

fn search_metadata(request: &SearchRequest) -> Result<Vec<SearchResult>> {
    let mut command = jj_command(request);
    command.args([
        "log",
        "--no-graph",
        "--revisions",
        request.revset.as_deref().unwrap_or("all()"),
        "--template",
        r#"commit_id.shortest() ++ "\x1f" ++ change_id.shortest() ++ "\x1f" ++ description ++ "\x1f" ++ bookmarks.join(",") ++ "\x1f" ++ tags.join(",") ++ "\x1e""#,
    ]);
    if let Some(path) = &request.path {
        command.arg(path);
    }
    let matcher = build_matcher(&request.query, request.regex)?;
    let mut results = Vec::new();
    let mut child = spawn(command)?;
    let mut output = Vec::new();
    let mut reader = BufReader::new(child.stdout.take().expect("stdout is piped"));
    while reader.read_until(RECORD as u8, &mut output)? != 0 {
        let record = String::from_utf8_lossy(&output);
        let record = record.trim_end_matches(RECORD);
        let mut fields = record.split(FIELD);
        let (Some(revision), Some(change_id), Some(description), Some(bookmarks), Some(tags)) = (
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
        ) else {
            output.clear();
            continue;
        };
        let searchable = format!("{description}\n{bookmarks}\n{tags}");
        if !matches(&matcher, &searchable) {
            output.clear();
            continue;
        }
        let title = description.lines().next().unwrap_or_default().to_owned();
        let labels = [bookmarks, tags]
            .into_iter()
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join(", ");
        results.push(SearchResult {
            revision: revision.to_owned(),
            change_id: change_id.to_owned(),
            title,
            labels,
            file: None,
            line: None,
            detail: description.to_owned(),
        });
        if results.len() == request.limit {
            child
                .kill()
                .context("could not stop jj after result limit")?;
            child.wait().context("could not wait for jj")?;
            return Ok(results);
        }
        output.clear();
    }
    ensure_success(child)?;
    Ok(results)
}

fn search_changes(request: &SearchRequest) -> Result<Vec<SearchResult>> {
    let matcher = build_matcher(&request.query, request.regex)?;
    let mut command = jj_command(request);
    command.args([
        "log",
        "--no-graph",
        "--revisions",
        request.revset.as_deref().unwrap_or("all()"),
        "--patch",
        "--git",
        "--template",
        r#"commit_id.shortest() ++ "\x1f" ++ change_id.shortest() ++ "\x1f" ++ description.first_line() ++ "\x1e\n""#,
    ]);
    if let Some(path) = &request.path {
        command.arg(path);
    }
    let mut child = spawn(command)?;
    let mut reader = BufReader::new(child.stdout.take().expect("stdout is piped"));
    let mut results = Vec::new();
    let mut revision = String::new();
    let mut change_id = String::new();
    let mut title = String::new();
    let mut file = None;
    let mut line = None;
    let mut buffer = String::new();
    while reader.read_line(&mut buffer)? != 0 {
        let raw = buffer.trim_end_matches(['\r', '\n']);
        if let Some(header) = raw.strip_suffix(RECORD) {
            let mut fields = header.split(FIELD);
            fields.next().unwrap_or_default().clone_into(&mut revision);
            fields.next().unwrap_or_default().clone_into(&mut change_id);
            fields.next().unwrap_or_default().clone_into(&mut title);
            file = None;
            line = None;
        } else if let Some(path) = raw.strip_prefix("+++ b/") {
            file = Some(path.to_owned());
        } else if raw.starts_with("@@ ") {
            line = hunk_start(raw);
        } else if let Some(content) = raw.strip_prefix('+') {
            if !raw.starts_with("+++") && matches(&matcher, content) {
                push_line_result(
                    &mut results,
                    &revision,
                    &change_id,
                    &title,
                    file.as_deref(),
                    line,
                    content,
                );
            }
            line = line.map(|value| value + 1);
        } else if raw.starts_with(' ') {
            line = line.map(|value| value + 1);
        }
        if results.len() == request.limit {
            child
                .kill()
                .context("could not stop jj after result limit")?;
            child.wait().context("could not wait for jj")?;
            return Ok(results);
        }
        buffer.clear();
    }
    ensure_success(child)?;
    Ok(results)
}

fn search_snapshot(request: &SearchRequest) -> Result<Vec<SearchResult>> {
    let matcher = build_matcher(&request.query, request.regex)?;
    let revision = request.revset.as_deref().unwrap_or("@");
    let mut list = jj_command(request);
    list.args(["file", "list", "--revision", revision]);
    if let Some(path) = &request.path {
        list.arg(path);
    }
    let mut list_child = spawn(list)?;
    let mut list_reader = BufReader::new(list_child.stdout.take().expect("stdout is piped"));
    let mut results = Vec::new();
    let mut path = String::new();
    let mut inspected = 0_usize;
    while list_reader.read_line(&mut path)? != 0 {
        let path_line = path.trim_end_matches(['\r', '\n']);
        if !path_line.is_empty() {
            inspected += 1;
            scan_snapshot_file(request, &matcher, revision, path_line, &mut results)?;
            if results.len() == request.limit {
                list_child
                    .kill()
                    .context("could not stop jj after result limit")?;
                list_child.wait().context("could not wait for jj")?;
                return Ok(results);
            }
        }
        path = String::new();
    }
    ensure_success(list_child)?;
    if inspected == 0 && request.path.is_some() {
        bail!("no files match the requested snapshot path")
    }
    Ok(results)
}

fn scan_snapshot_file(
    request: &SearchRequest,
    matcher: &Regex,
    revision: &str,
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
        if matches(matcher, content_line) {
            push_line_result(
                results,
                revision,
                "",
                "snapshot",
                Some(path),
                Some(source_line),
                content_line,
            );
            if results.len() == request.limit {
                child
                    .kill()
                    .context("could not stop jj after result limit")?;
                child.wait().context("could not wait for jj")?;
                return Ok(());
            }
        }
        content = String::new();
    }
    ensure_success(child)
}

fn push_line_result(
    results: &mut Vec<SearchResult>,
    revision: &str,
    change_id: &str,
    title: &str,
    file: Option<&str>,
    line: Option<usize>,
    detail: &str,
) {
    results.push(SearchResult {
        revision: revision.to_owned(),
        change_id: change_id.to_owned(),
        title: title.to_owned(),
        labels: String::new(),
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

fn ensure_success(child: Child) -> Result<()> {
    let output = child.wait_with_output().context("could not wait for jj")?;
    if output.status.success() {
        Ok(())
    } else {
        bail!(
            "jj command failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )
    }
}

fn build_matcher(query: &str, regex: bool) -> Result<Regex> {
    if regex {
        return Regex::new(query).context("invalid regular expression");
    }
    RegexBuilder::new(&regex::escape(query))
        .case_insensitive(true)
        .build()
        .context("could not build text matcher")
}

fn matches(matcher: &Regex, value: &str) -> bool {
    matcher.is_match(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_queries_are_literal_and_case_insensitive() {
        let matcher = build_matcher("fix [api]", false).unwrap();
        assert!(matches(&matcher, "Fix [API] response"));
        assert!(!matches(&matcher, "Fix api response"));
    }

    #[test]
    fn regex_queries_keep_their_meaning() {
        let matcher = build_matcher("fix (api|cli)", true).unwrap();
        assert!(matches(&matcher, "fix api"));
        assert!(!matches(&matcher, "fix UI"));
    }

    #[test]
    fn reads_new_file_line_from_a_diff_hunk() {
        assert_eq!(hunk_start("@@ -5,3 +12,8 @@"), Some(12));
        assert_eq!(hunk_start("@@ -0,0 +1 @@"), Some(1));
    }
}
