// Generated from: features/sel-permalink.feature
import { test } from "playwright-bdd";

test.describe('Selected-revision permalink', () => {

  test('?sel= selects a revision and further clicks update the URL', async ({ Given, When, Then, page }) => { 
    await Given('a stable older revision whose change id is remembered', null, { page }); 
    await When('the app is loaded with that change id in the sel parameter', null, { page }); 
    await Then('the row with that change id is selected', null, { page }); 
    await When('I select a different revision using the keyboard', null, { page }); 
    await Then('the URL sel parameter matches the newly selected row', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/sel-permalink.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given a stable older revision whose change id is remembered","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When the app is loaded with that change id in the sel parameter","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the row with that change id is selected","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I select a different revision using the keyboard","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then the URL sel parameter matches the newly selected row","stepMatchArguments":[]}]},
]; // bdd-data-end