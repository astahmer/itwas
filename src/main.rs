mod actions;
mod config;
mod dates;
mod fuzzy;
mod search;
mod tui;
mod web;

use std::path::PathBuf;

use anyhow::Result;
use std::io::Write as _;
use clap::{Parser, ValueEnum};
use config::Config;
use search::{MatchMode, Mode, SearchRequest};

#[derive(Debug, Parser)]
#[command(version, about = "Fast search through Jujutsu history")]
#[allow(clippy::struct_excessive_bools)]
struct Cli {
    /// Text to find. With no text, open the interactive picker.
    query: Option<String>,

    /// Search lane: metadata, changed lines, or one revision's snapshot.
    #[arg(short, long)]
    mode: Option<CliMode>,

    /// Jujutsu revset to search.
    #[arg(short, long)]
    revset: Option<String>,

    /// File prefix/fileset passed to Jujutsu where supported.
    #[arg(short, long)]
    path: Option<String>,

    /// Interpret query as a regular expression.
    #[arg(short = 'x', long)]
    regex: bool,

    /// Interpret query as a fuzzy subsequence pattern.
    #[arg(short = 'z', long)]
    fuzzy: bool,

    /// Only results committed on/after this date (YYYY-MM-DD, HH:MM, 2d, 3w…).
    #[arg(long)]
    since: Option<String>,

    /// Only results committed before this date (inclusive whole day).
    #[arg(long)]
    until: Option<String>,

    /// Maximum number of results.
    #[arg(short, long)]
    limit: Option<usize>,

    /// Emit machine-readable JSON instead of plain text.
    #[arg(long)]
    json: bool,

    /// Open the interactive picker even when QUERY is supplied.
    #[arg(short, long)]
    tui: bool,

    /// Repository to search; repeat to search several (CLI output only).
    #[arg(short = 'R', long)]
    repository: Vec<PathBuf>,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum CliMode {
    Metadata,
    Changes,
    Snapshot,
}

impl From<CliMode> for Mode {
    fn from(value: CliMode) -> Self {
        match value {
            CliMode::Metadata => Self::Metadata,
            CliMode::Changes => Self::Changes,
            CliMode::Snapshot => Self::Snapshot,
        }
    }
}

fn main() -> Result<()> {
    dates::init();
    if std::env::args().nth(1).as_deref() == Some("web") {
        return web::run_from_args(std::env::args().skip(2));
    }
    let cli = Cli::parse();
    let stored = Config::load().unwrap_or_default();

    let match_mode = if cli.regex {
        MatchMode::Regex
    } else if cli.fuzzy {
        MatchMode::Fuzzy
    } else {
        match stored.match_mode.as_deref() {
            Some("regex") => MatchMode::Regex,
            Some("fuzzy") => MatchMode::Fuzzy,
            _ => MatchMode::Literal,
        }
    };

    let request = SearchRequest {
        query: cli.query.clone().unwrap_or_default(),
        mode: cli.mode.map(Mode::from).or(stored.mode).unwrap_or_default(),
        revset: cli.revset.or(stored.revset),
        path: cli.path.or(stored.path),
        since: cli.since.as_deref().map(|value| {
            dates::parse(value).unwrap_or_else(|| panic_date_flag("--since", value))
        }),
        until: cli.until.as_deref().map(|value| {
            dates::parse_with_end(value, true).unwrap_or_else(|| panic_date_flag("--until", value))
        }),
        match_mode,
        limit: cli.limit.or(stored.limit).unwrap_or(200),
        ..SearchRequest::default()
    };
    let open_tui = cli.tui || cli.query.is_none();

    if open_tui {
        let final_message = tui::run(request, cli.repository.first().cloned())?;
        if let Some(message) = final_message {
            println!("{message}");
        }
        return Ok(());
    }

    let repositories = if cli.repository.is_empty() { vec![None] } else { cli.repository.into_iter().map(Some).collect() };
    let multi = repositories.len() > 1;
    let mut any_results = false;
    let mut json_blocks = Vec::new();
    for repository in &repositories {
        let mut scoped = request.clone();
        scoped.repository.clone_from(repository);
        let output = search::search(&scoped)?;
        if !output.results.is_empty() {
            any_results = true;
        }
        if cli.json {
            let label = repository
                .as_ref()
                .map(|path| path.to_string_lossy().into_owned())
                .unwrap_or_default();
            let block = search::to_json(&output);
            json_blocks.push(if multi {
                format!("{{\"repository\":{},\"output\":{block}}}", crate_json_string(&label))
            } else {
                block
            });
        } else {
            if multi {
                let label = repository
                    .as_ref().map_or_else(|| ".".to_owned(), |path| path.display().to_string());
                println!("## {label}");
            }
            let mut stdout = std::io::stdout().lock();
            for result in &output.results {
                // Exit quietly when the consumer closes the pipe (e.g. `| head`).
                if writeln!(stdout, "{result}").is_err() {
                    return Ok(());
                }
            }
        }
    }
    if cli.json {
        let mut stdout = std::io::stdout().lock();
        if writeln!(stdout, "[{}]", json_blocks.join(",")).is_err() {
            return Ok(());
        }
    }
    if !any_results && !cli.json {
        std::process::exit(1);
    }
    Ok(())
}

// Diverges via process::exit after printing a hint.
fn panic_date_flag(flag: &str, value: &str) -> i64 {
    eprintln!("{flag}: invalid date '{value}' — accepted: {}", dates::FORMAT_HINT);
    std::process::exit(2);
}

fn crate_json_string(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}
