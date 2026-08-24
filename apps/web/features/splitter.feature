Feature: Resizable splitter between list and detail panels

  Scenario: Panels are side-by-side and resizable
    Given the app is loaded with no query
    When I wait for results
    Then the list and detail panels are side-by-side
    And a resize trigger is visible between them
    When I drag the resize trigger left by 120 pixels
    Then the detail panel width changed by at least 80 pixels
