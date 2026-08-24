Feature: Large-diff cutoff

  Scenario: Oversized diff falls back to plain view with a notice
    Given the app is loaded with a tiny "?maxdiff=1" cutoff override
    And a result row is selected
    Then the large-diff cutoff notice appears
    When I click "try rich view anyway"
    Then the cutoff notice disappears
