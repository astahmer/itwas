// Generated from: features/footer.feature
import { test } from "playwright-bdd";

test.describe('Footer content', () => {

  test('Footer does not contain the old tagline', async ({ Given, Then, page }) => { 
    await Given('the app is loaded with no query', null, { page }); 
    await Then('the footer does not mention "no terminal required"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('features/footer.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is loaded with no query","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Outcome","textWithKeyword":"Then the footer does not mention \"no terminal required\"","stepMatchArguments":[{"group":{"start":28,"value":"\"no terminal required\"","children":[{"start":29,"value":"no terminal required","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end