Feature: Lane help popover

  Scenario: Question mark explains the three lanes
    Given the app is loaded with no query
    When I click the lane help button
    Then the popover mentions "metadata", "changes" and "snapshot"
