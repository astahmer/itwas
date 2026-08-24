Feature: Keyboard navigation from filters into results

  Scenario: ArrowDown from query focuses the selected row
    Given the app is loaded with no query
    When I wait for results
    And I press ArrowDown in the query input
    Then the focused element is the selected result row

  Scenario: Arrows move selection within the list
    Given the app is loaded with no query
    When I wait for results
    And I press ArrowDown in the query input
    Then the focused element is the selected result row
    When I press ArrowDown again on the focused row
    Then a later row becomes selected
    When I press ArrowUp on the selected row
    Then the first row is selected again
