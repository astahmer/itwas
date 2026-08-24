Feature: Theme toggle persists

  Scenario: Toggling theme flips data-mode and survives reload
    Given the app is loaded with no query
    When I click the theme toggle
    Then documentElement data-mode flips from dark to light
    When I reload the page
    Then data-mode is still light
