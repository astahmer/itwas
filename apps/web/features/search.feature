Feature: itwas web search

  Scenario: Search filtering reduces visible matches
    Given the app is loaded with no query
    When the match count settles
    And I type "search" into the query field
    Then the visible result rows decrease compared to before
