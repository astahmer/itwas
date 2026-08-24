Feature: Revset cheat sheet

  Scenario: Clicking a cheat-sheet entry inserts its token
    Given the app is loaded with no query
    When I open the help popover and switch to the Revsets tab
    And I click the first cheat-sheet token
    Then the revset field contains that token
