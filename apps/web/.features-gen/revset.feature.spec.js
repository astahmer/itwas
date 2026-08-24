// Generated from: features/revset.feature
import { test } from "playwright-bdd";

test.describe('Revset combobox with presets', () => {

  test('Picking a preset sets free-form value too', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I focus the revset field and type "mi"', null, { page }); 
    await And('I pick the "mine()" suggestion', null, { page }); 
    await Then('the revset field equals "mine()"', null, { page }); 
    await When('I type "@-" into the revset field directly', null, { page }); 
    await Then('the revset field equals "@-"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/revset.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I focus the revset field and type \"mi\"","stepMatchArguments":[{"group":{"start":34,"value":"\"mi\"","children":[{"start":35,"value":"mi","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Action","textWithKeyword":"And I pick the \"mine()\" suggestion","stepMatchArguments":[{"group":{"start":11,"value":"\"mine()\"","children":[{"start":12,"value":"mine()","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":7,"keywordType":"Outcome","textWithKeyword":"Then the revset field equals \"mine()\"","stepMatchArguments":[{"group":{"start":24,"value":"\"mine()\"","children":[{"start":25,"value":"mine()","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":11,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"When I type \"@-\" into the revset field directly","stepMatchArguments":[{"group":{"start":7,"value":"\"@-\"","children":[{"start":8,"value":"@-","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then the revset field equals \"@-\"","stepMatchArguments":[{"group":{"start":24,"value":"\"@-\"","children":[{"start":25,"value":"@-","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end