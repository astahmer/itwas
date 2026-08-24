Feature: Footer content

  Scenario: Footer does not contain the old tagline
    Given the app is loaded with no query
    Then the footer does not mention "no terminal required"
