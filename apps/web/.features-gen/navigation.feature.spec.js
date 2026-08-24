// Generated from: features/navigation.feature
import { test } from "playwright-bdd";

test.describe('Keyboard navigation from filters into results', () => {

  test('ArrowDown from query focuses the selected row', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I wait for results', null, { page }); 
    await And('I press ArrowDown in the query input', null, { page }); 
    await Then('the focused element is the selected result row', null, { page }); 
  });

  test('Arrows move selection within the list', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I wait for results', null, { page }); 
    await And('I press ArrowDown in the query input', null, { page }); 
    await Then('the focused element is the selected result row', null, { page }); 
    await When('I press ArrowDown again on the focused row', null, { page }); 
    await Then('a later row becomes selected', null, { page }); 
    await When('I press ArrowUp on the selected row', null, { page }); 
    await Then('the first row is selected again', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/navigation.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I wait for results","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"And I press ArrowDown in the query input","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then the focused element is the selected result row","stepMatchArguments":[]}]},
  {"pwTestLine":13,"pickleLine":9,"tags":[],"steps":[{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":15,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When I wait for results","stepMatchArguments":[]},{"pwStepLine":16,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"And I press ArrowDown in the query input","stepMatchArguments":[]},{"pwStepLine":17,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Then the focused element is the selected result row","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":14,"keywordType":"Action","textWithKeyword":"When I press ArrowDown again on the focused row","stepMatchArguments":[]},{"pwStepLine":19,"gherkinStepLine":15,"keywordType":"Outcome","textWithKeyword":"Then a later row becomes selected","stepMatchArguments":[]},{"pwStepLine":20,"gherkinStepLine":16,"keywordType":"Action","textWithKeyword":"When I press ArrowUp on the selected row","stepMatchArguments":[]},{"pwStepLine":21,"gherkinStepLine":17,"keywordType":"Outcome","textWithKeyword":"Then the first row is selected again","stepMatchArguments":[]}]},
]; // bdd-data-end