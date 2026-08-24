// Generated from: features/lane-help.feature
import { test } from "playwright-bdd";

test.describe('Lane help popover', () => {

  test('Question mark explains the three lanes', async ({ Given, When, Then, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I click the lane help button', null, { page }); 
    await Then('the popover mentions "metadata", "changes" and "snapshot"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/lane-help.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I click the lane help button","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then the popover mentions \"metadata\", \"changes\" and \"snapshot\"","stepMatchArguments":[{"group":{"start":21,"value":"\"metadata\"","children":[{"start":22,"value":"metadata","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":33,"value":"\"changes\"","children":[{"start":34,"value":"changes","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":47,"value":"\"snapshot\"","children":[{"start":48,"value":"snapshot","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end