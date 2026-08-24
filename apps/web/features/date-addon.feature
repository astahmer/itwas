Feature: Date filter addon with calendar popover

  Scenario: Preset fills the after input
    Given the app is loaded with no query
    When I click the date addon next to "after"
    Then the popover shows preset buttons including "last week"
    When I click the "last week" preset
    Then the after input contains a YYYY-MM-DD date
