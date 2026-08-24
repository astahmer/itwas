// Generated from: features/theme.feature
import { test } from "playwright-bdd";

test.describe('Theme toggle persists', () => {

  test('Toggling theme flips data-mode and survives reload', async ({ Given, When, Then, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I click the theme toggle', null, { page }); 
    await Then('documentElement data-mode flips from dark to light', null, { page }); 
    await When('I reload the page', null, { page }); 
    await Then('data-mode is still light', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/theme.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I click the theme toggle","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then documentElement data-mode flips from dark to light","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I reload the page","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then data-mode is still light","stepMatchArguments":[]}]},
]; // bdd-data-end