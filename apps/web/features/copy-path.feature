Feature: Copy file path from results

  Scenario: Copy path button writes path to clipboard
    Given the app is loaded in changes mode with query "version"
    When I wait for results
    And I click the copy-path button on the first row that has one
    Then the clipboard contains a non-empty file path
