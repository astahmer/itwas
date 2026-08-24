Feature: Sortable result columns

  Scenario: Date header sorts ascending then back to newest-first
    Given the app is loaded with sort state cleared and the default first row captured
    When I click the "date" column sort header
    Then the date column is marked ascending
    And the first visible change id differs from the captured default
    And I click the date column sort header a second time
    Then the date column is marked descending
    And the first visible change id equals the captured default
