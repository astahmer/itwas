// Generated from: features/virtualization.feature
import { test } from "playwright-bdd";

test.describe('Row virtualization on long lists', () => {

  test('Long changes-lane results stay windowed while scrolling', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded in changes mode with query "e"', null, { page }); 
    await When('I wait for results', null, { page }); 
    await And('I scroll the results list to the bottom and back', null, { page }); 
    await Then('the rendered row count stays bounded', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/virtualization.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded in changes mode with query \"e\"","stepMatchArguments":[{"group":{"start":45,"value":"\"e\"","children":[{"start":46,"value":"e","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I wait for results","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"And I scroll the results list to the bottom and back","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then the rendered row count stays bounded","stepMatchArguments":[]}]},
]; // bdd-data-end