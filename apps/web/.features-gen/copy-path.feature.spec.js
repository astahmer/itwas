// Generated from: features/copy-path.feature
import { test } from "playwright-bdd";

test.describe('Copy file path from results', () => {

  test('Copy path button writes path to clipboard', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded in changes mode with query "version"', null, { page }); 
    await When('I wait for results', null, { page }); 
    await And('I click the copy-path button on the first row that has one', null, { page }); 
    await Then('the clipboard contains a non-empty file path', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/copy-path.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded in changes mode with query \"version\"","stepMatchArguments":[{"group":{"start":45,"value":"\"version\"","children":[{"start":46,"value":"version","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I wait for results","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"And I click the copy-path button on the first row that has one","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then the clipboard contains a non-empty file path","stepMatchArguments":[]}]},
]; // bdd-data-end