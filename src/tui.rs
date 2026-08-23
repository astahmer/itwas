use std::{
    io::{self, stdout},
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::{Duration, Instant},
};

use anyhow::{Context, Result};
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};
use ratatui::{
    Terminal,
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
};

use crate::search::{self, Mode, SearchRequest, SearchResult};

const DEBOUNCE: Duration = Duration::from_millis(75);
const MAX_VISIBLE_RESULTS: usize = 200;

type AppTerminal = Terminal<CrosstermBackend<io::Stdout>>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Field {
    Query,
    Revset,
    Path,
}

impl Field {
    const fn next(self) -> Self {
        match self {
            Self::Query => Self::Revset,
            Self::Revset => Self::Path,
            Self::Path => Self::Query,
        }
    }

    const fn label(self) -> &'static str {
        match self {
            Self::Query => "query",
            Self::Revset => "revset",
            Self::Path => "path",
        }
    }
}

enum WorkerMessage {
    Complete(u64, Result<Vec<SearchResult>, String>),
}

struct App {
    request: SearchRequest,
    field: Field,
    selected: usize,
    results: Vec<SearchResult>,
    error: Option<String>,
    generation: u64,
    dirty_since: Option<Instant>,
    worker_busy: bool,
    show_help: bool,
    sender: Sender<WorkerMessage>,
    receiver: Receiver<WorkerMessage>,
}

impl App {
    fn new(request: SearchRequest) -> Self {
        let (sender, receiver) = mpsc::channel();
        Self {
            request,
            field: Field::Query,
            selected: 0,
            results: Vec::new(),
            error: None,
            generation: 0,
            dirty_since: None,
            worker_busy: false,
            show_help: false,
            sender,
            receiver,
        }
    }

    fn schedule_search(&mut self) {
        self.generation += 1;
        self.dirty_since = Some(Instant::now());
        self.error = None;
    }

    fn tick(&mut self) {
        while let Ok(message) = self.receiver.try_recv() {
            let WorkerMessage::Complete(generation, outcome) = message;
            self.worker_busy = false;
            if generation == self.generation {
                match outcome {
                    Ok(results) => {
                        self.results = results;
                        self.selected = self.selected.min(self.results.len().saturating_sub(1));
                    }
                    Err(error) => self.error = Some(error),
                }
            }
        }
        let ready = self
            .dirty_since
            .is_some_and(|time| time.elapsed() >= DEBOUNCE);
        if !ready || self.worker_busy || self.request.query.is_empty() {
            return;
        }
        self.dirty_since = None;
        self.worker_busy = true;
        let request = self.request.clone();
        let generation = self.generation;
        let sender = self.sender.clone();
        thread::spawn(move || {
            let outcome = search::search(&request).map_err(|error| format!("{error:#}"));
            let _ = sender.send(WorkerMessage::Complete(generation, outcome));
        });
    }

    fn active_value(&self) -> &str {
        match self.field {
            Field::Query => &self.request.query,
            Field::Revset => self.request.revset.as_deref().unwrap_or(""),
            Field::Path => self.request.path.as_deref().unwrap_or(""),
        }
    }

    fn push(&mut self, character: char) {
        match self.field {
            Field::Query => self.request.query.push(character),
            Field::Revset => self
                .request
                .revset
                .get_or_insert_with(String::new)
                .push(character),
            Field::Path => self
                .request
                .path
                .get_or_insert_with(String::new)
                .push(character),
        }
        self.schedule_search();
    }

    fn pop(&mut self) {
        let became_empty = match self.field {
            Field::Query => {
                self.request.query.pop();
                false
            }
            Field::Revset => self.request.revset.as_mut().is_some_and(|value| {
                value.pop();
                value.is_empty()
            }),
            Field::Path => self.request.path.as_mut().is_some_and(|value| {
                value.pop();
                value.is_empty()
            }),
        };
        if became_empty {
            match self.field {
                Field::Revset => self.request.revset = None,
                Field::Path => self.request.path = None,
                Field::Query => {}
            }
        }
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

    fn move_selection(&mut self, delta: isize) {
        if self.results.is_empty() {
            return;
        }
        self.selected = self
            .selected
            .saturating_add_signed(delta)
            .min(self.results.len().saturating_sub(1));
    }
}

pub fn run(request: SearchRequest) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = App::new(request);
    if !app.request.query.is_empty() {
        app.schedule_search();
    }
    let result = run_loop(&mut terminal, &mut app);
    restore_terminal(&mut terminal)?;
    result
}

fn setup_terminal() -> Result<AppTerminal> {
    enable_raw_mode().context("could not enable raw terminal mode")?;
    let mut output = stdout();
    execute!(output, EnterAlternateScreen).context("could not enter alternate screen")?;
    Terminal::new(CrosstermBackend::new(output)).context("could not initialize terminal")
}

fn restore_terminal(terminal: &mut AppTerminal) -> Result<()> {
    disable_raw_mode().context("could not restore terminal mode")?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)
        .context("could not leave alternate screen")?;
    terminal.show_cursor().context("could not restore cursor")
}

fn run_loop(terminal: &mut AppTerminal, app: &mut App) -> Result<()> {
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
        if key.kind == KeyEventKind::Press && handle_key(app, key) {
            return Ok(());
        }
    }
}

fn handle_key(app: &mut App, key: KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc | KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => true,
        KeyCode::Tab => {
            app.field = app.field.next();
            false
        }
        KeyCode::Up => {
            app.move_selection(-1);
            false
        }
        KeyCode::Down => {
            app.move_selection(1);
            false
        }
        KeyCode::Backspace => {
            app.pop();
            false
        }
        KeyCode::Char('h') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.show_help = !app.show_help;
            false
        }
        KeyCode::Char('t') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.cycle_mode();
            false
        }
        KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.request.regex = !app.request.regex;
            app.schedule_search();
            false
        }
        KeyCode::Char(character) => {
            app.push(character);
            false
        }
        _ => false,
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
            Constraint::Length(5),
            Constraint::Length(1),
        ])
        .split(frame.area());
    render_header(frame, rows[0]);
    render_scope(frame, app, rows[1]);
    render_input(frame, app, rows[2]);
    render_results(frame, app, rows[3]);
    render_preview(frame, app, rows[4]);
    frame.render_widget(
        Paragraph::new(status(app)).style(Style::default().fg(Color::DarkGray)),
        rows[5],
    );
}

fn render_header(frame: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let title = Line::from(vec![
        Span::styled(
            " itwas ",
            Style::default()
                .fg(Color::Black)
                .bg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            "  jj history, no index",
            Style::default().fg(Color::DarkGray),
        ),
    ]);
    frame.render_widget(Paragraph::new(title), area);
}

fn render_scope(frame: &mut ratatui::Frame, app: &App, area: ratatui::layout::Rect) {
    let mode = app.request.mode;
    let scope = format!(
        " {}  ·  revset: {}  ·  path: {}  ·  {} ",
        mode_name(mode),
        app.request
            .revset
            .as_deref()
            .unwrap_or(default_revset(mode)),
        app.request.path.as_deref().unwrap_or("any"),
        if app.request.regex {
            "regex"
        } else {
            "literal"
        }
    );
    frame.render_widget(
        Paragraph::new(scope).style(Style::default().fg(Color::Cyan)),
        area,
    );
}

fn render_input(frame: &mut ratatui::Frame, app: &App, area: ratatui::layout::Rect) {
    let input = Paragraph::new(format!("{}: {}", app.field.label(), app.active_value()))
        .style(
            Style::default()
                .fg(Color::White)
                .add_modifier(Modifier::BOLD),
        )
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" type to search · Tab changes field "),
        );
    frame.render_widget(input, area);
}

fn render_results(frame: &mut ratatui::Frame, app: &App, area: ratatui::layout::Rect) {
    let items = app
        .results
        .iter()
        .take(MAX_VISIBLE_RESULTS)
        .enumerate()
        .map(|(index, result)| {
            let prefix = if index == app.selected { "› " } else { "  " };
            let location = result.file.as_ref().map_or_else(String::new, |path| {
                format!(
                    " {path}{}",
                    result
                        .line
                        .map_or_else(String::new, |line| format!(":{line}"))
                )
            });
            let style = if index == app.selected {
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };
            ListItem::new(format!(
                "{prefix}{}{}  {}",
                result.revision, location, result.title
            ))
            .style(style)
        });
    frame.render_widget(
        List::new(items).block(Block::default().borders(Borders::ALL).title(" matches ")),
        area,
    );
}

fn render_preview(frame: &mut ratatui::Frame, app: &App, area: ratatui::layout::Rect) {
    let fallback = "Type a query. Metadata searches descriptions, bookmarks and tags.";
    let preview = app
        .results
        .get(app.selected)
        .map_or(fallback, |item| item.detail.as_str());
    frame.render_widget(
        Paragraph::new(preview)
            .wrap(Wrap { trim: false })
            .block(Block::default().borders(Borders::ALL).title(" preview ")),
        area,
    );
}

fn status(app: &App) -> &str {
    if app.show_help {
        "Tab fields · Ctrl-T lane · Ctrl-R regex · ↑↓ select · Esc quit"
    } else if let Some(error) = &app.error {
        error
    } else if app.worker_busy || app.dirty_since.is_some() {
        "searching…"
    } else if app.request.query.is_empty() {
        "metadata = descriptions/bookmarks/tags · changes = added diff lines · snapshot = files at one revision"
    } else if app.results.is_empty() {
        "no matches"
    } else {
        "Tab fields · Ctrl-T lane · Ctrl-R regex · ↑↓ preview · Ctrl-H help"
    }
}

fn default_revset(mode: Mode) -> &'static str {
    if mode == Mode::Snapshot { "@" } else { "all()" }
}

const fn mode_name(mode: Mode) -> &'static str {
    match mode {
        Mode::Metadata => "metadata",
        Mode::Changes => "changes",
        Mode::Snapshot => "snapshot",
    }
}
