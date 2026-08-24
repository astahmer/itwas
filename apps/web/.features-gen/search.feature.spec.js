// Generated from: features/search.feature
import { test } from "playwright-bdd";

test.describe('itwas web search', () => {

  test('Search filtering reduces visible matches', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('the match count settles', null, { page }); 
    await And('I type "search" into the query field', null, { page }); 
    await Then('the visible result rows decrease compared to before', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/search.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When the match count settles","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"And I type \"search\" into the query field","stepMatchArguments":[{"group":{"start":7,"value":"\"search\"","children":[{"start":8,"value":"search","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then the visible result rows decrease compared to before","stepMatchArguments":[]}]},
]; // bdd-data-end