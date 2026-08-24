// Generated from: features/column-resize.feature
import { test } from "playwright-bdd";

test.describe('Resizable result columns', () => {

  test('Dragging a resize handle persists the width', async ({ Given, When, Then, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await When('I drag the "date" column resize handle right by 40px', null, { page }); 
    await Then('localStorage key "itwas-col-widths" has a numeric "date" entry', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/column-resize.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I drag the \"date\" column resize handle right by 40px","stepMatchArguments":[{"group":{"start":11,"value":"\"date\"","children":[{"start":12,"value":"date","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":48,"value":"40"},"parameterTypeName":"int"}]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then localStorage key \"itwas-col-widths\" has a numeric \"date\" entry","stepMatchArguments":[{"group":{"start":17,"value":"\"itwas-col-widths\"","children":[{"start":18,"value":"itwas-col-widths","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":50,"value":"\"date\"","children":[{"start":51,"value":"date","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end