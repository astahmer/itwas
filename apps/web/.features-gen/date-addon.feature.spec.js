// Generated from: features/date-addon.feature
import { test } from "playwright-bdd";

test.describe('Date filter addon with calendar popover', () => {

  test('Preset fills the after input', async ({ Given, When, Then, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I click the date addon next to "after"', null, { page }); 
    await Then('the popover shows preset buttons including "last week"', null, { page }); 
    await When('I click the "last week" preset', null, { page }); 
    await Then('the after input contains a YYYY-MM-DD date', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/date-addon.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I click the date addon next to \"after\"","stepMatchArguments":[{"group":{"start":31,"value":"\"after\"","children":[{"start":32,"value":"after","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the popover shows preset buttons including \"last week\"","stepMatchArguments":[{"group":{"start":43,"value":"\"last week\"","children":[{"start":44,"value":"last week","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I click the \"last week\" preset","stepMatchArguments":[{"group":{"start":12,"value":"\"last week\"","children":[{"start":13,"value":"last week","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then the after input contains a YYYY-MM-DD date","stepMatchArguments":[]}]},
]; // bdd-data-end