//! One-off jj invocations and system integrations used by the TUI
//! (working-copy probe, bookmarks, diff stats, full diffs, clipboard, editor).

use std::process::Command;

use anyhow::{Context, Result};

fn jj(repository: Option<&std::path::Path>) -> Command {
    let mut command = Command::new("jj");
    command.arg("--ignore-working-copy");
    if let Some(repo) = repository {
        command.args(["--repository", &repo.to_string_lossy()]);
    }
    command
}

/// Commit + change id of the working-copy revision (for `@` markers).
pub fn working_copy_ids(repository: Option<&std::path::Path>) -> Result<(String, String)> {
    let output = jj(repository)
        .args(["log", "-r", "@", "--no-graph", "-T"])
        .arg("commit_id ++ \"\\x1f\" ++ change_id")
        .output()
        .context("failed to run jj")?;
    anyhow::ensure!(output.status.success(), "jj log @ failed");
    let text = String::from_utf8_lossy(&output.stdout);
    let (commit, change) = text.trim().split_once('\u{1f}').unwrap_or(("", ""));
    Ok((commit.to_owned(), change.to_owned()))
}

/// Bookmark names in the repository.
pub fn list_bookmarks(repository: Option<&std::path::Path>) -> Result<Vec<String>> {
    let output = jj(repository)
        .args(["bookmark", "list", "-T"])
        .arg(r#"name ++ "\n""#)
        .output()
        .context("failed to run jj")?;
    anyhow::ensure!(
        output.status.success(),
        "jj bookmark list failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    let mut names: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::to_owned)
        .filter(|name| !name.is_empty())
        .collect();
    names.sort();
    names.dedup();
    Ok(names)
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct DiffStat {
    pub added: u64,
    pub removed: u64,
}

impl DiffStat {
    pub fn is_empty(self) -> bool {
        self.added == 0 && self.removed == 0
    }
}

/// Short stats for one revision via `jj diff --stat`.
pub fn fetch_diffstat(
    repository: Option<&std::path::Path>,
    commit_id: &str,
) -> Option<DiffStat> {
    let output = jj(repository)
        .args(["diff", "--stat", "-r", commit_id])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_stat_summary(&String::from_utf8_lossy(&output.stdout))
}

fn parse_stat_summary(output: &str) -> Option<DiffStat> {
    let line = output
        .lines()
        .rev()
        .find(|line| line.contains("insertion") || line.contains("deletion"))?;
    let added = extract_number(line, "insertion").unwrap_or(0);
    let removed = extract_number(line, "deletion").unwrap_or(0);
    Some(DiffStat { added, removed })
}

fn extract_number(line: &str, keyword: &str) -> Option<u64> {
    let index = line.find(keyword)?;
    let digits: String = line[..index]
        .chars()
        .rev()
        .skip_while(|c: &char| c.is_whitespace())
        .take_while(char::is_ascii_digit)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    digits.parse().ok()
}

#[derive(Clone, Debug)]
pub struct RelatedChange {
    pub relation: &'static str,
    pub change_id: String,
    pub timestamp: Option<i64>,
    pub title: String,
}

/// Parents and children of a revision, newest-first within each group.
pub fn fetch_related(
    repository: Option<&std::path::Path>,
    commit_id: &str,
) -> Result<Vec<RelatedChange>> {
    let mut related = Vec::new();
    for (relation, suffix) in [("parent", "-"), ("child", "+")] {
        let mut command = jj(repository);
        command.args([
            "log",
            "--no-graph",
            "--revisions",
            &format!("({commit_id}{suffix})"),
            "--template",
            r#"change_id.shortest(4) ++ "" ++ committer.timestamp().format("%s") ++ "" ++ description.first_line() ++ """#,
        ]);
        let output = command.output().context("failed to run jj")?;
        if !output.status.success() {
            anyhow::bail!(
                "{}",
                String::from_utf8_lossy(&output.stderr).trim().to_owned()
            );
        }
        for record in String::from_utf8_lossy(&output.stdout).split('\u{1e}') {
            let record = record.trim_start();
            if record.is_empty() {
                continue;
            }
            let mut fields = record.split('\u{1f}');
            related.push(RelatedChange {
                relation,
                change_id: fields.next().unwrap_or_default().to_owned(),
                timestamp: fields.next().and_then(|value| value.parse().ok()),
                title: fields.next().unwrap_or_default().to_owned(),
            });
        }
    }
    Ok(related)
}

/// Full patch text of a revision (`jj diff --git`).
pub fn fetch_full_diff(repository: Option<&std::path::Path>, commit_id: &str) -> Result<String> {
    let output = jj(repository)
        .args(["diff", "--git", "-r", commit_id])
        .output()
        .context("failed to run jj")?;
    anyhow::ensure!(
        output.status.success(),
        "jj diff failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Copy text to the system clipboard (macOS / Wayland / X11).
pub fn copy_to_clipboard(text: &str) -> Result<()> {
    #[cfg(target_os = "macos")]
    let candidates: [&str; 1] = ["pbcopy"];
    #[cfg(all(unix, not(target_os = "macos")))]
    let candidates: [&str; 2] = ["wl-copy", "xclip"];
    #[cfg(not(unix))]
    let candidates: [&str; 0] = [];
    for program in candidates {
        let mut command = Command::new(program);
        if program == "xclip" {
            command.args(["-selection", "clipboard"]);
        }
        command.stdin(std::process::Stdio::piped());
        if let Ok(mut child) = command.spawn() {
            use std::io::Write as _;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(text.as_bytes())?;
            }
            drop(child.stdin.take());
            child.wait()?;
            return Ok(());
        }
    }
    anyhow::bail!("no clipboard tool found (pbcopy/wl-copy/xclip)")
}

/// Open a file (optionally at a line) in `$VISUAL`/`$EDITOR`.
pub fn open_in_editor(file: &str, line: Option<usize>) -> Result<()> {
    let editor = std::env::var("VISUAL")
        .or_else(|_| std::env::var("EDITOR"))
        .unwrap_or_else(|_| "vim".to_owned());
    let mut parts = editor.split_whitespace();
    let program = parts.next().context("$EDITOR is empty")?;
    let mut command = Command::new(program);
    for argument in parts {
        command.arg(argument);
    }
    if line.is_some() {
        command.arg(format!("+{}", line.unwrap_or(1)));
    }
    command.arg(file);
    command.status().context("failed to launch editor")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_jj_stat_summary_lines() {
        let output = "\
README.md | 63 ++++++++++++++++++++++
plans/x.md | 158 +++++++++++++++++++++++++++
3 files changed, 224 insertions(+), 2 deletions(-)";
        let stat = parse_stat_summary(output).unwrap();
        assert_eq!(stat.added, 224);
        assert_eq!(stat.removed, 2);
    }

    #[test]
    fn handles_single_insertion_grammar() {
        let stat =
            parse_stat_summary("1 file changed, 1 insertion(+)").unwrap();
        assert_eq!(stat.added, 1);
        assert_eq!(stat.removed, 0);
    }

    #[test]
    fn missing_summary_is_none() {
        assert_eq!(parse_stat_summary("no summary here"), None);
    }
}
