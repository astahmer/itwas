// Generated from: features/splitter.feature
import { test } from "playwright-bdd";

test.describe('Resizable splitter between list and detail panels', () => {

  test('Panels are side-by-side and resizable', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I wait for results', null, { page }); 
    await Then('the list and detail panels are side-by-side', null, { page }); 
    await And('a resize trigger is visible between them', null, { page }); 
    await When('I drag the resize trigger left by 120 pixels', null, { page }); 
    await Then('the detail panel width changed by at least 80 pixels', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/splitter.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I wait for results","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the list and detail panels are side-by-side","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"And a resize trigger is visible between them","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"When I drag the resize trigger left by 120 pixels","stepMatchArguments":[{"group":{"start":34,"value":"120"},"parameterTypeName":"int"}]},{"pwStepLine":12,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then the detail panel width changed by at least 80 pixels","stepMatchArguments":[{"group":{"start":43,"value":"80"},"parameterTypeName":"int"}]}]},
]; // bdd-data-end