mod search;
mod tui;

use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, ValueEnum};
use search::{Mode, SearchRequest};

#[derive(Debug, Parser)]
#[command(version, about = "Fast search through Jujutsu history")]
struct Cli {
    /// Text to find. With no text, open the interactive picker.
    query: Option<String>,

    /// Search lane: metadata, changed lines, or one revision's snapshot.
    #[arg(short, long, value_enum, default_value_t = CliMode::Metadata)]
    mode: CliMode,

    /// Jujutsu revset to search.
    #[arg(short, long)]
    revset: Option<String>,

    /// File prefix/fileset passed to Jujutsu where supported.
    #[arg(short, long)]
    path: Option<String>,

    /// Interpret query as a regular expression.
    #[arg(short = 'x', long)]
    regex: bool,

    /// Open the interactive picker even when QUERY is supplied.
    #[arg(short, long)]
    tui: bool,

    /// Search this repository rather than the current directory's repository.
    #[arg(short = 'R', long)]
    repository: Option<PathBuf>,
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
    let cli = Cli::parse();
    let open_tui = cli.tui || cli.query.is_none();
    let request = SearchRequest {
        query: cli.query.unwrap_or_default(),
        mode: cli.mode.into(),
        revset: cli.revset,
        path: cli.path,
        regex: cli.regex,
        repository: cli.repository,
        limit: 200,
    };

    if open_tui {
        return tui::run(request);
    }

    for result in search::search(&request)? {
        println!("{result}");
    }

    Ok(())
}
