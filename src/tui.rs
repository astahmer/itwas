use std::{
    collections::{HashMap, HashSet, VecDeque},
    io,
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::{Duration, Instant},
};

use anyhow::{Context as _, Result};
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};
use ratatui::{
    Terminal,
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
};

use crate::{
    actions,
    dates,
    search::{self, MatchMode, Mode, SearchRequest, SearchResult},
};

const DEBOUNCE: Duration = Duration::from_millis(75);
const STAT_BATCH: usize = 16;

type AppTerminal = Terminal<CrosstermBackend<io::Stdout>>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Field {
    Query,
    Revset,
    Path,
    After,
    Until,
}

impl Field {
    const ALL: [Field; 5] = [
        Field::Query,
        Field::Revset,
        Field::Path,
        Field::After,
        Field::Until,
    ];

    fn next(self) -> Self {
        let index = Self::ALL.iter().position(|f| *f == self).unwrap_or(0);
        Self::ALL[(index + 1) % Self::ALL.len()]
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
enum View {
    #[default]
    Preview,
    Diff,
}

#[derive(Debug)]
enum WorkerMessage {
    Complete(u64, Result<search::SearchOutput, String>),
    Stats(Vec<(String, actions::DiffStat)>),
    Diff(String, Result<String, String>),
}

#[allow(clippy::struct_excessive_bools)]
struct App {
    request: SearchRequest,
    /// Raw editable text of the After/Until fields (parsed on search).
    after_input: String,
    until_input: String,
    field: Field,
    selected: usize,
    results: Vec<SearchResult>,
    truncated: bool,
    error: Option<String>,
    generation: u64,
    dirty_since: Option<Instant>,
    worker_busy: bool,
    show_help: bool,
    wc_commit_id: Option<String>,
    view: View,
    diff_scroll: usize,
    diffs: HashMap<String, String>,
    diffs_loading: HashSet<String>,
    stats: HashMap<String, actions::DiffStat>,
    stat_queue: VecDeque<String>,
    stat_busy: bool,
    bookmarks: Vec<String>,
    bookmark_overlay: Option<(String, usize)>,
    actions_popup: bool,
    notice: Option<String>,
    final_message: Option<String>,
    sender: Sender<WorkerMessage>,
    receiver: Receiver<WorkerMessage>,
}

impl App {
    fn new(request: SearchRequest) -> Self {
        let (sender, receiver) = mpsc::channel();
        Self {
            request,
            after_input: String::new(),
            until_input: String::new(),
            field: Field::Query,
            selected: 0,
            results: Vec::new(),
            truncated: false,
            error: None,
            generation: 0,
            dirty_since: None,
            worker_busy: false,
            show_help: false,
            wc_commit_id: None,
            view: View::Preview,
            diff_scroll: 0,
            diffs: HashMap::new(),
            diffs_loading: HashSet::new(),
            stats: HashMap::new(),
            stat_queue: VecDeque::new(),
            stat_busy: false,
            bookmarks: Vec::new(),
            bookmark_overlay: None,
            actions_popup: false,
            notice: None,
            final_message: None,
            sender,
            receiver,
        }
    }

    fn schedule_search(&mut self) {
        self.generation += 1;
        self.dirty_since = Some(Instant::now());
        self.error = None;
    }

    fn apply_date_fields(&mut self) {
        self.request.since = None;
        self.request.until = None;
        if !self.after_input.trim().is_empty() {
            match dates::parse(&self.after_input) {
                Some(timestamp) => self.request.since = Some(timestamp),
                None => self.error = Some(format!("invalid after date: {}", self.after_input)),
            }
        }
        if !self.until_input.trim().is_empty() {
            match dates::parse_with_end(&self.until_input, true) {
                Some(timestamp) => self.request.until = Some(timestamp),
                None => self.error = Some(format!("invalid until date: {}", self.until_input)),
            }
        }
    }

    fn tick(&mut self) {
        while let Ok(message) = self.receiver.try_recv() {
            match message {
                WorkerMessage::Complete(generation, outcome) => {
                    self.worker_busy = false;
                    if generation == self.generation {
                        match outcome {
                            Ok(output) => {
                                self.results = output.results;
                                self.truncated = output.truncated;
                                self.selected =
                                    self.selected.min(self.results.len().saturating_sub(1));
                                for result in &self.results {
                                    if !self.stats.contains_key(&result.commit_id)
                                        && !self.stat_queue.contains(&result.commit_id)
                                    {
                                        self.stat_queue.push_back(result.commit_id.clone());
                                    }
                                }
                            }
                            Err(error) => self.error = Some(error),
                        }
                    }
                }
                WorkerMessage::Stats(batch) => {
                    self.stat_busy = false;
                    for (commit_id, stat) in batch {
                        self.stats.insert(commit_id, stat);
                    }
                }
                WorkerMessage::Diff(commit_id, outcome) => {
                    self.diffs_loading.remove(&commit_id);
                    match outcome {
                        Ok(diff) => {
                            self.diffs.insert(commit_id, diff);
                        }
                        Err(error) => {
                            if self.view == View::Diff
                                && self.current_commit().is_some_and(|id| *id == commit_id)
                            {
                                self.notice = Some(error);
                            }
                        }
                    }
                }
            }
        }

        if !self.stat_busy
            && let Some(batch) = self.take_stat_batch()
        {
            self.stat_busy = true;
            let sender = self.sender.clone();
            thread::spawn(move || {
                let fetched = batch
                    .iter()
                    .filter_map(|commit_id| {
                        actions::fetch_diffstat(None, commit_id)
                            .map(|stat| (commit_id.clone(), stat))
                    })
                    .collect::<Vec<_>>();
                let _ = sender.send(WorkerMessage::Stats(fetched));
            });
        }

        if self.view == View::Diff
            && let Some(commit_id) = self.current_commit().cloned()
            && !self.diffs.contains_key(&commit_id)
            && !self.diffs_loading.contains(&commit_id)
        {
            self.diffs_loading.insert(commit_id.clone());
            let sender = self.sender.clone();
            thread::spawn(move || {
                let outcome =
                    actions::fetch_full_diff(None, &commit_id).map_err(|error| format!("{error:#}"));
                let _ = sender.send(WorkerMessage::Diff(commit_id, outcome));
            });
        }

        let ready = self.dirty_since.is_some_and(|time| time.elapsed() >= DEBOUNCE);
        if !ready || self.worker_busy || self.bookmark_overlay.is_some() {
            return;
        }
        self.apply_date_fields();
        self.dirty_since = None;
        self.worker_busy = true;
        self.generation += 1;
        let request = self.request.clone();
        let generation = self.generation;
        let sender = self.sender.clone();
        thread::spawn(move || {
            let outcome = search::search(&request).map_err(|error| format!("{error:#}"));
            let _ = sender.send(WorkerMessage::Complete(generation, outcome));
        });
    }

    fn take_stat_batch(&mut self) -> Option<Vec<String>> {
        if self.stat_queue.is_empty() {
            return None;
        }
        let mut batch = Vec::new();
        while let Some(commit_id) = self.stat_queue.pop_front() {
            if !self.stats.contains_key(&commit_id) {
                batch.push(commit_id);
            }
            if batch.len() == STAT_BATCH {
                break;
            }
        }
        (!batch.is_empty()).then_some(batch)
    }

    /// Prioritize the selected row's stat so it appears immediately.
    fn prioritize_selected_stat(&mut self) {
        if let Some(commit_id) = self.current_commit().cloned()
            && !self.stats.contains_key(&commit_id)
            && let Some(position) = self.stat_queue.iter().position(|id| *id == commit_id)
        {
            self.stat_queue.remove(position);
            self.stat_queue.push_front(commit_id);
        }
    }

    fn current_commit(&self) -> Option<&String> {
        self.results.get(self.selected).map(|result| &result.commit_id)
    }

    fn current_result(&self) -> Option<&SearchResult> {
        self.results.get(self.selected)
    }

    fn field_value_mut(&mut self) -> &mut String {
        match self.field {
            Field::Query => &mut self.request.query,
            Field::Revset => self.request.revset.get_or_insert_with(String::new),
            Field::Path => self.request.path.get_or_insert_with(String::new),
            Field::After => &mut self.after_input,
            Field::Until => &mut self.until_input,
        }
    }

    fn push(&mut self, character: char) {
        self.field_value_mut().push(character);
        self.schedule_search();
    }

    fn pop(&mut self) {
        self.field_value_mut().pop();
        self.schedule_search();
    }

    fn cycle_mode(&mut self) {
        self.request.mode = match self.request.mode {
            Mode::Metadata => Mode::Changes,
            Mode::Changes => Mode::Snapshot,
            Mode::Snapshot => Mode::Metadata,
        };
        self.schedule_search();
    }

    fn cycle_match_mode(&mut self) {
        self.request.match_mode = match self.request.match_mode {
            MatchMode::Literal => MatchMode::Regex,
            MatchMode::Regex => MatchMode::Fuzzy,
            MatchMode::Fuzzy => MatchMode::Literal,
        };
        self.schedule_search();
    }

    fn cycle_revset_preset(&mut self) {
        static PRESETS: [&str; 4] = ["all()", "main..@", "mine()", "@--"];
        let next_index = PRESETS
            .iter()
            .position(|preset| Some(*preset) == self.request.revset.as_deref())
            .map_or(0, |index| (index + 1) % PRESETS.len());
        self.field = Field::Revset;
        self.request.revset = Some(PRESETS[next_index].to_owned());
        self.schedule_search();
    }

    fn move_selection(&mut self, delta: isize) {
        if self.results.is_empty() {
            return;
        }
        let new_selected = self
            .selected
            .saturating_add_signed(delta)
            .min(self.results.len().saturating_sub(1));
        if new_selected != self.selected {
            self.selected = new_selected;
            self.diff_scroll = 0;
            self.prioritize_selected_stat();
        }
    }

    fn toggle_diff_view(&mut self) {
        self.view = match self.view {
            View::Preview => View::Diff,
            View::Diff => View::Preview,
        };
        self.diff_scroll = 0;
    }

    fn scroll_diff(&mut self, delta: isize) {
        let max = self
            .current_commit()
            .and_then(|commit_id| self.diffs.get(commit_id))
            .map_or(0, |diff| diff.lines().count());
        self.diff_scroll = self.diff_scroll.saturating_add_signed(delta).min(max);
    }

    fn open_bookmarks_overlay(&mut self) {
        if self.bookmark_overlay.is_some() {
            return;
        }
        if self.bookmarks.is_empty()
            && let Ok(names) = actions::list_bookmarks(self.request.repository.as_deref())
        {
            self.bookmarks = names;
        }
        self.bookmark_overlay = Some((String::new(), 0));
    }

    fn filtered_bookmarks(&self) -> Vec<&str> {
        let lowered = self
            .bookmark_overlay
            .as_ref()
            .map_or(String::new(), |(filter, _)| filter.to_lowercase());
        self.bookmarks
            .iter()
            .map(String::as_str)
            .filter(|name| name.to_lowercase().contains(&lowered))
            .collect()
    }

    fn confirm_bookmark(&mut self) {
        let Some((_, index)) = self.bookmark_overlay else {
            return;
        };
        if let Some(name) = self.filtered_bookmarks().get(index).copied() {
            self.request.revset = Some(name.to_owned());
            self.field = Field::Revset;
            self.bookmark_overlay = None;
            self.schedule_search();
        }
    }
}

/// Exit decision after a key press: Quit, OpenEditor(file, line), Continue.
enum Flow {
    Quit,
    Editor(String, Option<usize>),
    Continue,
}

pub fn run(mut request: SearchRequest, repository: Option<std::path::PathBuf>) -> Result<Option<String>> {
    request.repository = repository;
    let mut terminal = setup_terminal()?;
    let mut app = App::new(request);
    app.wc_commit_id = actions::working_copy_ids(app.request.repository.as_deref())
        .ok()
        .map(|(commit_id, _)| commit_id);
    app.schedule_search(); // initial results even with an empty query
    let outcome = run_loop(&mut terminal, &mut app);
    restore_terminal(&mut terminal)?;
    outcome.map(|_| app.final_message)
}

fn setup_terminal() -> Result<AppTerminal> {
    enable_raw_mode().context("could not enable raw terminal mode")?;
    let mut output = io::stdout();
    execute!(output, EnterAlternateScreen).context("could not enter alternate screen")?;
    Terminal::new(CrosstermBackend::new(output)).context("could not initialize terminal")
}

fn restore_terminal(terminal: &mut AppTerminal) -> Result<()> {
    disable_raw_mode().context("could not restore terminal mode")?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)
        .context("could not leave alternate screen")?;
    terminal.show_cursor().context("could not restore cursor")
}

fn run_loop(terminal: &mut AppTerminal, app: &mut App) -> Result<Flow> {
    loop {
        app.tick();
        terminal
            .draw(|frame| draw(frame, app))
            .context("could not draw picker")?;
        if !event::poll(Duration::from_millis(25)).context("could not poll terminal events")? {
            continue;
        }
        let Event::Key(key) = event::read().context("could not read terminal event")? else {
            continue;
        };
        if key.kind != KeyEventKind::Press {
            continue;
        }
        match handle_key(app, key)? {
            Flow::Quit => return Ok(Flow::Quit),
            Flow::Editor(file, line) => {
                let _ = with_suspended_terminal(terminal, || {
                    crate::actions::open_in_editor(&file, line)
                });
            }
            Flow::Continue => {}
        }
    }
}

/// Temporarily leave the alternate screen to hand control to an external editor.
fn with_suspended_terminal<T>(terminal: &mut AppTerminal, action: impl FnOnce() -> T) -> T {
    let _ = disable_raw_mode();
    let _ = execute!(io::stdout(), LeaveAlternateScreen);
    let result = action();
    let _ = enable_raw_mode();
    let _ = execute!(io::stdout(), EnterAlternateScreen);
    let _ = terminal.clear();
    result
}

fn handle_key(app: &mut App, key: KeyEvent) -> Result<Flow> {
    handle_key_inner(app, key)
}

#[allow(clippy::unnecessary_wraps)]
fn handle_key_inner(app: &mut App, key: KeyEvent) -> Result<Flow> {
    // Bookmark overlay captures input first.
    if app.bookmark_overlay.is_some() && handle_bookmark_key(app, key) {
        return Ok(Flow::Continue);
    }
    // Actions popup captures input second.
    if app.actions_popup {
        return Ok(handle_action_key(app, key));
    }
    app.notice = None;
    match key.code {
        KeyCode::Esc => Ok(Flow::Quit),
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Ok(Flow::Quit)
        }
        KeyCode::Tab => {
            app.field = app.field.next();
            Ok(Flow::Continue)
        }
        KeyCode::Up => {
            app.move_selection(-1);
            Ok(Flow::Continue)
        }
        KeyCode::Down => {
            app.move_selection(1);
            Ok(Flow::Continue)
        }
        KeyCode::PageUp => {
            app.scroll_diff(-10);
            Ok(Flow::Continue)
        }
        KeyCode::PageDown => {
            app.scroll_diff(10);
            Ok(Flow::Continue)
        }
        KeyCode::Backspace => {
            app.pop();
            Ok(Flow::Continue)
        }
        KeyCode::Delete => {
            app.field_value_mut().clear();
            app.schedule_search();
            Ok(Flow::Continue)
        }
        KeyCode::Enter => {
            if let Some(result) = app.current_result() {
                app.final_message =
                    Some(format!("{}\n# jj new {}", result.display_line(), result.change_id));
            } else {
                app.final_message = None;
            }
            Ok(Flow::Quit)
        }
        KeyCode::Char('h') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.show_help = !app.show_help;
            Ok(Flow::Continue)
        }
        KeyCode::Char('t') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.cycle_mode();
            Ok(Flow::Continue)
        }
        KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.cycle_match_mode();
            Ok(Flow::Continue)
        }
        KeyCode::Char('p') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.cycle_revset_preset();
            Ok(Flow::Continue)
        }
        KeyCode::Char('b') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.open_bookmarks_overlay();
            Ok(Flow::Continue)
        }
        KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.toggle_diff_view();
            Ok(Flow::Continue)
        }
        KeyCode::Char('a') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.actions_popup = app.current_result().is_some();
            Ok(Flow::Continue)
        }
        KeyCode::Char(character) => {
            app.push(character);
            Ok(Flow::Continue)
        }
        _ => Ok(Flow::Continue),
    }
}

/// Returns true when the overlay consumed the key.
fn handle_bookmark_key(app: &mut App, key: KeyEvent) -> bool {
    let Some((filter, index)) = app.bookmark_overlay.as_mut() else {
        return false;
    };
    match key.code {
        KeyCode::Esc => app.bookmark_overlay = None,
        KeyCode::Up => *index = index.saturating_sub(1),
        KeyCode::Down => {
            let max = app.filtered_bookmarks().len().saturating_sub(1);
            let (_, index) = app.bookmark_overlay.as_mut().expect("checked by caller");
            *index = (*index + 1).min(max);
        }
        KeyCode::Enter => {
            app.confirm_bookmark();
        }
        KeyCode::Backspace => {
            filter.pop();
        }
        KeyCode::Char(character) => filter.push(character),
        _ => {}
    }
    true
}

/// Handle a key press while the actions popup is open.
fn handle_action_key(app: &mut App, key: KeyEvent) -> Flow {
    let selected = app.current_result().cloned();
    app.actions_popup = false;
    #[allow(clippy::match_same_arms)]
    match key.code {
        KeyCode::Esc | KeyCode::Char('a') => Flow::Continue,
        KeyCode::Char('c') => {
            if let Some(result) = selected {
                match actions::copy_to_clipboard(&result.change_id) {
                    Ok(()) => app.notice = Some(format!("copied {}", result.change_id)),
                    Err(error) => app.notice = Some(error.to_string()),
                }
            }
            Flow::Continue
        }
        KeyCode::Char('n') => {
            if let Some(result) = selected {
                let hint = format!("jj new {}", result.change_id);
                match actions::copy_to_clipboard(&hint) {
                    Ok(()) => app.notice = Some(format!("{hint} (copied)")),
                    Err(error) => app.notice = Some(error.to_string()),
                }
            }
            Flow::Continue
        }
        KeyCode::Char('e') => match selected.and_then(|result| {
            result.file.clone().map(|file| (file, result.line))
        }) {
            Some((file, line)) => Flow::Editor(file, line),
            None => Flow::Continue,
        },
        _ => Flow::Continue,
    }
}

fn draw(frame: &mut ratatui::Frame, app: &App) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Length(2),
            Constraint::Length(3),
            Constraint::Min(5),
            Constraint::Length(7),
            Constraint::Length(1),
        ])
        .split(frame.area());
    render_header(frame, rows[0]);
    render_scope(frame, app, rows[1]);
    render_input(frame, app, rows[2]);
    render_results(frame, app, rows[3]);
    render_detail(frame, app, rows[4]);
    frame.render_widget(
        Paragraph::new(status_line(app)).style(Style::default().fg(Color::DarkGray)),
        rows[5],
    );
    if app.show_help {
        render_help(frame);
    }
    if let Some((filter, selected)) = &app.bookmark_overlay {
        render_bookmark_overlay(frame, app, filter, *selected);
    }
    if app.actions_popup {
        render_actions_popup(frame);
    }
}

fn render_header(frame: &mut ratatui::Frame, area: Rect) {
    let title = Line::from(vec![
        Span::styled(
            " itwas ",
            Style::default()
                .fg(Color::Black)
                .bg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled("  jj history, no index", Style::default().fg(Color::DarkGray)),
    ]);
    frame.render_widget(Paragraph::new(title), area);
}

fn count_label(app: &App) -> String {
    let count = app.results.len();
    if count == 0 {
        return if app.error.is_some() || app.dirty_since.is_some() {
            "…".to_owned()
        } else {
            "no matches".to_owned()
        };
    }
    if app.truncated {
        format!("{count}+ matches")
    } else {
        format!("{count} match{}", if count == 1 { "" } else { "es" })
    }
}

fn render_scope(frame: &mut ratatui::Frame, app: &App, area: Rect) {
    let scope = format!(
        " {}  ·  revset: {}  ·  path: {}  ·  {}  ·  {} ",
        app.request.mode.name(),
        app.request.revset.as_deref().unwrap_or(if app.request.mode == Mode::Snapshot { "@" } else { "all()" }),
        app.request.path.as_deref().unwrap_or("any"),
        match app.request.match_mode {
            MatchMode::Literal => "literal",
            MatchMode::Regex => "regex",
            MatchMode::Fuzzy => "fuzzy",
        },
        count_label(app),
    );
    frame.render_widget(
        Paragraph::new(scope).style(Style::default().fg(Color::Cyan)),
        area,
    );
}

fn render_input(frame: &mut ratatui::Frame, app: &App, area: Rect) {
    let values: [(&str, &str); 5] = [
        ("query", app.request.query.as_str()),
        ("revset", app.request.revset.as_deref().unwrap_or("")),
        ("path", app.request.path.as_deref().unwrap_or("")),
        ("after", app.after_input.as_str()),
        ("until", app.until_input.as_str()),
    ];
    let spans = values
        .iter()
        .enumerate()
        .flat_map(|(index, (label, value))| {
            let active = Field::ALL[index] == app.field;
            let label_style = if active {
                Style::default().fg(Color::Black).bg(Color::Cyan).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::DarkGray)
            };
            [
                Span::styled(format!(" {label} "), label_style),
                Span::styled(
                    format!(" {value} "),
                    Style::default().fg(if active { Color::White } else { Color::Gray }),
                ),
            ]
        })
        .collect::<Vec<_>>();
    frame.render_widget(
        Paragraph::new(Line::from(spans)).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" type to search · Tab changes field "),
        ),
        area,
    );
}

/// Approximation of jj's default change-id coloring: each letter maps to a
/// stable hue on the red→blue spectrum, alternating light/dark per position.
fn change_id_spans(change_id: &str) -> Vec<Span<'static>> {
    change_id
        .chars()
        .enumerate()
        .map(|(index, character)| {
            let letter_index = character.to_ascii_lowercase() as u8 - b'a';
            let hue = f32::from((u16::from(letter_index) * 37 % 240) as u8);
            Span::styled(
                character.to_string(),
                Style::default().fg(hsl_color(hue, 0.85, if index % 2 == 0 { 0.62 } else { 0.45 })),
            )
        })
        .collect()
}

fn hsl_color(hue_degrees: f32, saturation: f32, lightness: f32) -> Color {
    #[allow(clippy::many_single_char_names)]
    fn channel(hue: f32, saturation: f32, lightness: f32) -> (f32, f32, f32) {
        let chroma = (1.0 - (2.0 * lightness - 1.0).abs()) * saturation;
        let secondary = chroma * (1.0 - ((hue / 60.0) % 2.0 - 1.0).abs());
        match hue {
            0.0..60.0 => (chroma, secondary, 0.0),
            60.0..120.0 => (secondary, chroma, 0.0),
            120.0..180.0 => (0.0, chroma, secondary),
            180.0..240.0 => (0.0, secondary, chroma),
            _ => (chroma, 0.0, secondary),
        }
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    fn to_byte(value: f32) -> u8 {
        ((value * 255.0).round().clamp(0.0, 255.0)) as u8
    }
    let (red, green, blue) = channel(hue_degrees, saturation, lightness);
    Color::Rgb(
        to_byte(red + lightness),
        to_byte(green + lightness),
        to_byte(blue + lightness),
    )
}

fn is_working_copy(app: &App, result: &SearchResult) -> bool {
    app.wc_commit_id.as_deref() == Some(result.commit_id.as_str())
}

fn render_results(frame: &mut ratatui::Frame, app: &App, area: Rect) {
    let items: Vec<ListItem> = app
        .results
        .iter()
        .enumerate()
        .map(|(index, result)| {
            let selected = index == app.selected;
            let mut spans = vec![
                Span::styled(
                    if selected { "›" } else { " " },
                    if selected {
                        Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)
                    } else {
                        Style::default().fg(Color::DarkGray)
                    },
                ),
                Span::styled(
                    if is_working_copy(app, result) { "@" } else { " " },
                    Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
                ),
                Span::raw(" "),
            ];
            spans.extend(change_id_spans(&result.change_id));
            spans.push(Span::raw(" "));
            for bookmark in &result.bookmarks {
                let color = if matches!(bookmark.as_str(), "main" | "master" | "trunk") {
                    Color::Green
                } else {
                    Color::Yellow
                };
                spans.push(Span::styled(
                    format!(" {bookmark}"),
                    Style::default().fg(color).add_modifier(Modifier::BOLD),
                ));
            }
            for tag in &result.tags {
                spans.push(Span::styled(
                    format!(" tag:{tag}"),
                    Style::default().fg(Color::LightMagenta),
                ));
            }
            if let Some(timestamp) = result.timestamp {
                spans.push(Span::styled(
                    format!("  {}", dates::relative(timestamp)),
                    Style::default().fg(Color::DarkGray),
                ));
            }
            if let Some(stat) = app.stats.get(&result.commit_id)
                && !stat.is_empty()
            {
                spans.push(Span::styled(
                    format!("  +{}", stat.added),
                    Style::default().fg(Color::LightGreen),
                ));
                spans.push(Span::styled(
                    format!(" −{}", stat.removed),
                    Style::default().fg(Color::LightRed),
                ));
            }
            if let Some(file) = &result.file {
                spans.push(Span::styled(
                    format!("  {file}{}", result.line.map_or_else(String::new, |l| format!(":{l}"))),
                    Style::default().fg(Color::Cyan),
                ));
            }
            spans.push(Span::raw("  "));
            spans.push(Span::styled(
                result.title.clone(),
                if selected {
                    Style::default().add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                },
            ));
            ListItem::new(Line::from(spans))
        })
        .collect();
    frame.render_widget(
        List::new(items).block(Block::default().borders(Borders::ALL).title(" matches ")),
        area,
    );
}

fn render_detail(frame: &mut ratatui::Frame, app: &App, area: Rect) {
    let title = if app.view == View::Diff {
        " diff — Ctrl-D preview · PgUp/PgDn scroll "
    } else {
        " preview "
    };
    let block = Block::default().borders(Borders::ALL).title(title);
    let lines: Vec<Line> = if app.view == View::Diff {
        let text = app
            .current_commit()
            .and_then(|commit_id| app.diffs.get(commit_id));
        match text {
            Some(diff) => diff
                .lines()
                .skip(app.diff_scroll)
                .map(|line| {
                    let style = if line.starts_with('+') && !line.starts_with("+++") {
                        Style::default().fg(Color::LightGreen)
                    } else if line.starts_with('-') && !line.starts_with("---") {
                        Style::default().fg(Color::LightRed)
                    } else if line.starts_with("@@") {
                        Style::default().fg(Color::Cyan)
                    } else {
                        Style::default().fg(Color::DarkGray)
                    };
                    Line::from(Span::styled(line.to_owned(), style))
                })
                .collect(),
            None => vec![Line::from(Span::styled(
                "loading diff…",
                Style::default().fg(Color::DarkGray),
            ))],
        }
    } else {
        match app.current_result() {
            Some(result) => {
                let mut lines = vec![Line::from(vec![
                    Span::styled(
                        result.change_id.clone(),
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                    Span::raw("  "),
                    Span::styled(
                        result.author.clone().unwrap_or_default(),
                        Style::default().fg(Color::DarkGray),
                    ),
                ])];
                if let Some(timestamp) = result.timestamp {
                    lines.push(Line::from(Span::styled(
                        dates::absolute(timestamp),
                        Style::default().fg(Color::DarkGray),
                    )));
                }
                let detail_lines: Vec<&str> = result.detail.lines().skip(1).collect();
                if detail_lines.is_empty() {
                    lines.push(Line::from(result.title.clone()));
                } else {
                    for detail_line in detail_lines {
                        lines.push(Line::from(detail_line.to_owned()));
                    }
                }
                lines
            }
            None => vec![Line::from(Span::styled(
                "Type to search · Enter prints selection · Ctrl-A actions · Ctrl-D diff · Ctrl-H help",
                Style::default().fg(Color::DarkGray),
            ))],
        }
    };
    frame.render_widget(
        Paragraph::new(lines).wrap(Wrap { trim: false }).block(block),
        area,
    );
}

fn render_help(frame: &mut ratatui::Frame) {
    let text = "\
Tab fields (query/revset/path/after/until) · Ctrl-T lane · Ctrl-R literal/regex/fuzzy
Ctrl-P revset preset · Ctrl-B bookmarks · Ctrl-D diff preview · PgUp/PgDn scroll
Ctrl-A actions (copy/jj new/editor) · Enter print selection · Esc quit";
    let area = centered_rect(frame.area(), 64, 7);
    frame.render_widget(Clear, area);
    frame.render_widget(
        Paragraph::new(text)
            .style(Style::default().bg(Color::Black))
            .block(Block::default().borders(Borders::ALL).title(" help ")),
        area,
    );
}

fn render_bookmark_overlay(frame: &mut ratatui::Frame, app: &App, filter: &str, selected: usize) {
    let area = centered_rect(frame.area(), 44, 14);
    frame.render_widget(Clear, area);
    let names = app.filtered_bookmarks();
    let items = names
        .iter()
        .take(area.height.saturating_sub(2) as usize)
        .enumerate()
        .map(|(index, name)| {
            let style = if index == selected {
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };
            ListItem::new(format!(" {name}")).style(style)
        })
        .collect::<Vec<_>>();
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(" filter ", Style::default().fg(Color::Black).bg(Color::Cyan)),
            Span::raw(format!(" {filter}")),
        ]))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" bookmarks — type to filter · Enter selects · Esc closes "),
        ),
        area,
    );
    if !items.is_empty() {
        let inner = Rect {
            x: area.x + 1,
            y: area.y + 1,
            width: area.width.saturating_sub(2),
            height: area.height.saturating_sub(2),
        };
        frame.render_widget(List::new(items), inner);
    }
}

fn render_actions_popup(frame: &mut ratatui::Frame) {
    let area = centered_rect(frame.area(), 46, 6);
    frame.render_widget(Clear, area);
    frame.render_widget(
        Paragraph::new("c copy change id · n copy `jj new <id>`\ne open file in editor · Esc close")
            .style(Style::default().bg(Color::Black))
            .block(Block::default().borders(Borders::ALL).title(" actions ")),
        area,
    );
}

fn centered_rect(area: Rect, percent_x: u16, height: u16) -> Rect {
    let width = area.width * percent_x / 100;
    Rect {
        x: area.x + (area.width.saturating_sub(width)) / 2,
        y: area.y + area.height.saturating_sub(height) / 2,
        width: width.min(area.width),
        height: height.min(area.height),
    }
}

fn status_line(app: &App) -> String {
    if let Some(notice) = &app.notice {
        return notice.clone();
    }
    if let Some(error) = &app.error {
        return error.clone();
    }
    if app.show_help {
        return "Tab fields · Ctrl-T lane · ↑↓ select · Esc quit".to_owned();
    }
    if app.worker_busy || app.dirty_since.is_some() {
        return "searching…".to_owned();
    }
    if app.results.is_empty() {
        "no matches — type to search, or Tab to edit revset/path".to_owned()
    } else {
        format!(
            "{} · Tab fields · Ctrl-T lane · Ctrl-R match · Ctrl-P presets · Ctrl-B bookmarks · Ctrl-A actions · Ctrl-D diff",
            count_label(app)
        )
    }
}
