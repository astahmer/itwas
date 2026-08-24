// Generated from: features/grouping.feature
import { test } from "playwright-bdd";

test.describe('Changes-lane grouping by commit', () => {

  test('Repeated matches in one commit collapse behind a group header', async ({ Given, When, Then, page }) => { 
    await Given('the app is loaded in changes mode with query "the"', null, { page }); 
    await When('I wait for results', null, { page }); 
    await Then('at least one group header with a match-count badge exists', null, { page }); 
    await When('I collapse the expanded group headers', null, { page }); 
    await Then('fewer rows are rendered than before', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/grouping.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded in changes mode with query \"the\"","stepMatchArguments":[{"group":{"start":45,"value":"\"the\"","children":[{"start":46,"value":"the","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I wait for results","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then at least one group header with a match-count badge exists","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I collapse the expanded group headers","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then fewer rows are rendered than before","stepMatchArguments":[]}]},
]; // bdd-data-end