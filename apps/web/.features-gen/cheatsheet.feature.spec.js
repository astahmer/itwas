// Generated from: features/cheatsheet.feature
import { test } from "playwright-bdd";

test.describe('Revset cheat sheet', () => {

  test('Clicking a cheat-sheet entry inserts its token', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I open the help popover and switch to the Revsets tab', null, { page }); 
    await And('I click the first cheat-sheet token', null, { page }); 
    await Then('the revset field contains that token', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/cheatsheet.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I open the help popover and switch to the Revsets tab","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"And I click the first cheat-sheet token","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then the revset field contains that token","stepMatchArguments":[]}]},
]; // bdd-data-end