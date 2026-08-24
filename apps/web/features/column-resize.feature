Feature: Resizable result columns

  Scenario: Dragging a resize handle persists the width
    Given the app is loaded with no query
    When I drag the "date" column resize handle right by 40px
    Then localStorage key "itwas-col-widths" has a numeric "date" entry
