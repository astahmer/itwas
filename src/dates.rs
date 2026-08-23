//! Date parsing/formatting for `after:`/`before:` filters and result display.

use std::sync::OnceLock;

use time::{
    Date, OffsetDateTime, Time, UtcOffset,
    macros::{format_description, offset},
};

static LOCAL_OFFSET: OnceLock<UtcOffset> = OnceLock::new();

/// Capture the local UTC offset once, before any worker threads are spawned.
/// `OffsetDateTime::now_local()` is unsound to call in multithreaded contexts.
pub fn init() {
    let _ = LOCAL_OFFSET.set(UtcOffset::current_local_offset().unwrap_or(offset!(UTC)));
}

fn now_local() -> OffsetDateTime {
    OffsetDateTime::now_utc().to_offset(
        LOCAL_OFFSET.get().copied().unwrap_or(time::macros::offset!(UTC)),
    )
}

/// Parse a user-supplied date expression into a unix timestamp (seconds).
///
/// Supported: `YYYY-MM-DD`, `YYYY-MM-DD HH:MM`, relative (`2d`, `3w`, `12h`,
/// `30m`), and the keywords `today`, `yesterday`, `now`. Dates are interpreted
/// in the local timezone captured at startup.
pub fn parse(expression: &str) -> Option<i64> {
    parse_with_end(expression, false)
}

/// Parse a date expression; when `end` is true and the expression is a bare
/// date (no time), resolve to the end of that day (23:59:59) so that
/// `before:`/`until:` are inclusive of the whole named day.
pub fn parse_with_end(expression: &str, end: bool) -> Option<i64> {
    let expression = expression.trim();
    if expression.is_empty() {
        return None;
    }
    if let Some(value) = parse_relative(expression) {
        return Some(value);
    }
    match expression {
        "now" => Some(now_local().unix_timestamp()),
        "today" | "yesterday" => {
            let mut midnight = now_local().replace_time(Time::MIDNIGHT);
            if expression == "yesterday" {
                midnight = midnight.checked_sub(time::Duration::days(1))?;
            }
            Some(if end {
                (midnight + time::Duration::seconds(86_399)).unix_timestamp()
            } else {
                midnight.unix_timestamp()
            })
        }
        _ => parse_absolute(expression, end),
    }
}

fn parse_relative(expression: &str) -> Option<i64> {
    let lowered = expression.to_ascii_lowercase();
    let (count, unit) = lowered.split_at(lowered.find(|c: char| c.is_ascii_alphabetic())?);
    let count: i64 = count.trim().parse().ok()?;
    let seconds = match unit {
        "m" => 60,
        "h" => 60 * 60,
        "d" => 24 * 60 * 60,
        "w" => 7 * 24 * 60 * 60,
        _ => return None,
    };
    Some(now_local().unix_timestamp() - count * seconds)
}

fn parse_absolute(expression: &str, end: bool) -> Option<i64> {
    let date_format = format_description!("[year]-[month]-[day]");
    let datetime_format = format_description!("[year]-[month]-[day] [hour]:[minute]");
    let offset = LOCAL_OFFSET.get().copied().unwrap_or(offset!(UTC));
    if let Ok(date) = Date::parse(expression, date_format) {
        let seconds = if end { 86_399 } else { 0 };
        return Some(date.with_time(Time::MIDNIGHT).assume_offset(offset).unix_timestamp() + seconds);
    }
    let primitive = time::PrimitiveDateTime::parse(expression, &datetime_format).ok()?;
    Some(primitive.assume_offset(offset).unix_timestamp())
}

/// `2 hours ago`-style label for a unix timestamp relative to now.
pub fn relative(timestamp: i64) -> String {
    const MINUTE: i64 = 60;
    const HOUR: i64 = 60 * MINUTE;
    const DAY: i64 = 24 * HOUR;
    const WEEK: i64 = 7 * DAY;
    const MONTH: i64 = 30 * DAY;
    const YEAR: i64 = 365 * DAY;
    let delta = now_local().unix_timestamp() - timestamp;
    if delta < 0 {
        "in the future".to_owned()
    } else if delta < MINUTE {
        "just now".to_owned()
    } else if delta < HOUR {
        plural(delta / MINUTE, "minute")
    } else if delta < DAY {
        plural(delta / HOUR, "hour")
    } else if delta < WEEK {
        plural(delta / DAY, "day")
    } else if delta < MONTH {
        plural(delta / WEEK, "week")
    } else if delta < YEAR {
        plural(delta / MONTH, "month")
    } else {
        plural(delta / YEAR, "year")
    }
}

fn plural(count: i64, unit: &str) -> String {
    if count == 1 { format!("1 {unit} ago") } else { format!("{count} {unit}s ago") }
}

/// `2026-08-23 14:03` local-time label.
pub fn absolute(timestamp: i64) -> String {
    let datetime = OffsetDateTime::from_unix_timestamp(timestamp)
        .unwrap_or(now_local())
        .to_offset(LOCAL_OFFSET.get().copied().unwrap_or(offset!(UTC)));
    let format = format_description!("[year]-[month]-[day] [hour]:[minute]");
    datetime.format(&format).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_iso_dates_and_datetimes() {
        assert!(parse("2026-08-01").is_some());
        assert!(parse("2026-08-01 14:30").is_some());
        assert_eq!(parse("garbage"), None);
        assert_eq!(parse(""), None);
    }

    #[test]
    fn parses_relative_units() {
        assert!(parse("2d").is_some());
        assert!(parse("3w").is_some());
        assert!(parse("12h").is_some());
        assert!(parse("30m").is_some());
        assert_eq!(parse("5x"), None);
    }

    #[test]
    fn keywords_resolve() {
        assert!(parse("today").is_some());
        assert!(parse("yesterday").is_some());
        assert!(parse("now").is_some());
    }

    #[test]
    fn relative_labels_are_bounded() {
        let now = parse("now").unwrap();
        assert_eq!(relative(now), "just now");
        assert_eq!(relative(now - 90), "1 minute ago");
    }
}
