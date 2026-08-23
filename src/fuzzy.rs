//! Minimal subsequence fuzzy matcher: all query characters must appear in
//! order (case-insensitive); score prefers consecutive runs and word starts.

#[derive(Debug)]
pub struct FuzzyMatch {
    /// Lower is better.
    #[allow(dead_code)]
    pub score: u32,
}

pub fn fuzzy_match(haystack: &str, needle: &str) -> Option<FuzzyMatch> {
    if needle.is_empty() {
        return Some(FuzzyMatch { score: 0 });
    }
    let haystack_lower = haystack.to_lowercase();
    let needle_lower = needle.to_lowercase();
    let mut score = 0_u32;
    let mut previous_hit: Option<usize> = None;
    let mut search_from = 0_usize;
    for character in needle_lower.chars() {
        let hit = haystack_lower[search_from..].find(character)? + search_from;
        // Reward adjacency and word boundaries; penalize gaps.
        match previous_hit {
            Some(previous) if hit == previous + 1 => score = score.saturating_sub(1),
            Some(previous) => score += u32::try_from((hit - previous - 1).min(8)).unwrap_or(8),
            None => {}
        }
        if hit == 0 || haystack_lower[..hit].ends_with([' ', '/', '-', '_', '.']) {
            score = score.saturating_sub(2);
        }
        previous_hit = Some(hit);
        search_from = hit + character.len_utf8();
    }
    // Prefer matches earlier in the string and in shorter strings.
    score += u32::try_from(previous_hit.unwrap_or(0) / 4).unwrap_or(0);
    Some(FuzzyMatch { score })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_all_characters_in_order() {
        assert!(fuzzy_match("add streaming lanes", "stln").is_some());
        assert!(fuzzy_match("add streaming lanes", "lnst").is_none());
    }

    #[test]
    fn empty_needle_matches_anything() {
        assert!(fuzzy_match("", "").is_some());
        assert!(fuzzy_match("anything", "").is_some());
    }

    #[test]
    fn consecutive_runs_score_better_than_gaps() {
        let tight = fuzzy_match("snapshot", "sna").unwrap().score;
        let gapped = fuzzy_match("search near anchor", "sna").unwrap().score;
        assert!(tight < gapped);
    }
}
