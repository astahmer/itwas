// Generated from: features/sorting.feature
import { test } from "playwright-bdd";

test.describe('Sortable result columns', () => {

  test('Date header sorts ascending then back to newest-first', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with sort state cleared and the default first row captured', null, { page }); 
    await When('I click the "date" column sort header', null, { page }); 
    await Then('the date column is marked ascending', null, { page }); 
    await And('the first visible change id differs from the captured default', null, { page }); 
    await And('I click the date column sort header a second time', null, { page }); 
    await Then('the date column is marked descending', null, { page }); 
    await And('the first visible change id equals the captured default', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/sorting.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with sort state cleared and the default first row captured","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I click the \"date\" column sort header","stepMatchArguments":[{"group":{"start":12,"value":"\"date\"","children":[{"start":13,"value":"date","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the date column is marked ascending","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"And the first visible change id differs from the captured default","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"And I click the date column sort header a second time","stepMatchArguments":[]},{"pwStepLine":12,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then the date column is marked descending","stepMatchArguments":[]},{"pwStepLine":13,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"And the first visible change id equals the captured default","stepMatchArguments":[]}]},
]; // bdd-data-end