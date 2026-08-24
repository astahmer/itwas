Feature: Row virtualization on long lists

  Scenario: Long changes-lane results stay windowed while scrolling
    Given the app is loaded in changes mode with query "e"
    When I wait for results
    And I scroll the results list to the bottom and back
    Then the rendered row count stays bounded
