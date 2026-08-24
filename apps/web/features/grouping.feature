Feature: Changes-lane grouping by commit

  Scenario: Repeated matches in one commit collapse behind a group header
    Given the app is loaded in changes mode with query "the"
    When I wait for results
    Then at least one group header with a match-count badge exists
    When I collapse the expanded group headers
    Then fewer rows are rendered than before
