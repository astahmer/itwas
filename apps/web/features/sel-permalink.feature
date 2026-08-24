Feature: Selected-revision permalink

  Scenario: ?sel= selects a revision and further clicks update the URL
    Given a stable older revision whose change id is remembered
    When the app is loaded with that change id in the sel parameter
    Then the row with that change id is selected
    When I select a different revision using the keyboard
    Then the URL sel parameter matches the newly selected row
