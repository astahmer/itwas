//! Optional config file: `~/.config/itwas/config.toml`.
//!
//! Hand-rolled `key = value` parsing — no TOML dependency. Unknown keys are
//! ignored so newer binaries stay forward compatible with older configs.

use std::path::PathBuf;

use anyhow::Result;

use crate::search::Mode;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Config {
    pub mode: Option<Mode>,
    pub revset: Option<String>,
    pub path: Option<String>,
    pub limit: Option<usize>,
    /// literal | regex | fuzzy
    pub match_mode: Option<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        Self::load_from(&config_path())
    }

    pub fn load_from(path: &PathBuf) -> Result<Self> {
        let contents = match std::fs::read_to_string(path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Self::default()),
            Err(error) => return Err(error.into()),
        };
        let mut config = Self::default();
        for line in contents.lines() {
            let line = line.split('#').next().unwrap_or_default().trim();
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            let key = key.trim();
            let value = value.trim().trim_matches('"');
            match key {
                "mode" => config.mode = value.parse().ok(),
                "revset" => config.revset = (!value.is_empty()).then(|| value.to_owned()),
                "path" => config.path = (!value.is_empty()).then(|| value.to_owned()),
                "limit" => config.limit = value.parse().ok(),
                "match" => config.match_mode = Some(value.to_owned()),
                _ => {}
            }
        }
        Ok(config)
    }
}

fn config_path() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("itwas")
        .join("config.toml")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_known_keys_and_ignores_comments_and_unknowns() {
        let dir = std::env::temp_dir().join(format!("itwas-config-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("config.toml");
        std::fs::write(
            &path,
            "# comment\nmode = \"changes\"\nrevset = \"main..@\"\nlimit = 50\nmatch = \"fuzzy\"\nbogus = 1\n",
        )
        .unwrap();
        let config = Config::load_from(&path).unwrap();
        assert_eq!(config.mode, Some(Mode::Changes));
        assert_eq!(config.revset.as_deref(), Some("main..@"));
        assert_eq!(config.limit, Some(50));
        assert_eq!(config.match_mode.as_deref(), Some("fuzzy"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn missing_file_is_default() {
        let config =
            Config::load_from(&PathBuf::from("/nonexistent/itwas/config.toml")).unwrap();
        assert_eq!(config, Config::default());
    }
}
