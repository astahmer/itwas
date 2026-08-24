// Generated from: features/large-diff.feature
import { test } from "playwright-bdd";

test.describe('Large-diff cutoff', () => {

  test('Oversized diff falls back to plain view with a notice', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with a tiny "?maxdiff=1" cutoff override', null, { page }); 
    await And('a result row is selected', null, { page }); 
    await Then('the large-diff cutoff notice appears', null, { page }); 
    await When('I click "try rich view anyway"', null, { page }); 
    await Then('the cutoff notice disappears', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/large-diff.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with a tiny \"?maxdiff=1\" cutoff override","stepMatchArguments":[{"group":{"start":30,"value":"\"?maxdiff=1\"","children":[{"start":31,"value":"?maxdiff=1","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"And a result row is selected","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the large-diff cutoff notice appears","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I click \"try rich view anyway\"","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then the cutoff notice disappears","stepMatchArguments":[]}]},
]; // bdd-data-end