Feature: Per-row copy actions

  Scenario: Row-level copy writes the change id without changing selection
    Given the app is loaded with no query
    When I click the row copy-id action on the first result
    Then the clipboard contains the first result's change id
    And the selected row is unchanged
