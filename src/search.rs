use std::{fmt, path::PathBuf, process::Command};

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

impl Mode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Metadata => "metadata",
            Self::Changes => "changes",
            Self::Snapshot => "snapshot",
        }
    }
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
}

impl fmt::Display for SearchResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let labels = (!self.labels.is_empty()).then(|| format!(" [{0}]", self.labels));
        write!(
            f,
            "{} {} {}{}",
            self.revision,
            self.change_id,
            self.title,
            labels.unwrap_or_default()
        )
    }
}

pub fn search(request: &SearchRequest) -> Result<Vec<SearchResult>> {
    match request.mode {
        Mode::Metadata => search_metadata(request),
        Mode::Changes | Mode::Snapshot => bail!(
            "{} search is not wired yet; use metadata while the first revision lands",
            request.mode.as_str()
        ),
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
    let output = command.output().context("failed to start jj")?;
    if !output.status.success() {
        bail!(
            "jj log failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }

    let matcher = build_matcher(&request.query, request.regex)?;
    let mut results = Vec::new();
    for record in String::from_utf8_lossy(&output.stdout).split(RECORD) {
        let mut fields = record.split(FIELD);
        let (Some(revision), Some(change_id), Some(description), Some(bookmarks), Some(tags)) = (
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
            fields.next(),
        ) else {
            continue;
        };
        let searchable = format!("{description}\n{bookmarks}\n{tags}");
        if !matches(&matcher, &searchable) {
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
        });
        if results.len() == request.limit {
            break;
        }
    }
    Ok(results)
}

fn jj_command(request: &SearchRequest) -> Command {
    let mut command = Command::new("jj");
    command.arg("--ignore-working-copy");
    if let Some(repository) = &request.repository {
        command.args(["--repository", repository.to_string_lossy().as_ref()]);
    }
    command
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
}
