Feature: Revset combobox with presets

  Scenario: Picking a preset sets free-form value too
    Given the app is loaded with no query
    When I focus the revset field and type "mi"
    And I pick the "mine()" suggestion
    Then the revset field equals "mine()"
    When I type "@-" into the revset field directly
    Then the revset field equals "@-"
