// Generated from: features/row-actions.feature
import { test } from "playwright-bdd";

test.describe('Per-row copy actions', () => {

  test('Row-level copy writes the change id without changing selection', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I click the row copy-id action on the first result', null, { page }); 
    await Then('the clipboard contains the first result\'s change id', null, { page }); 
    await And('the selected row is unchanged', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/row-actions.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I click the row copy-id action on the first result","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the clipboard contains the first result's change id","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"And the selected row is unchanged","stepMatchArguments":[]}]},
]; // bdd-data-end