import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';
const stamp = Date.now().toString(36);

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Conv Builder');
  await page.getByLabel('Email').fill(`conv-${stamp}@qub.test`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);
}

async function blankForm(page: Page) {
  await page.getByRole('button', { name: 'New' }).click();
  const [tab] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('menuitem', { name: 'Qub Forms' }).click()]);
  await tab.getByRole('link', { name: 'Blank form' }).click();
  await expect(tab).toHaveURL(/\/forms\/.+\/edit/);
  return tab;
}

const saved = (p: Page) => expect(p.getByText('All changes saved')).toBeVisible();

async function addQuestion(p: Page, typeLabel: string, text: string, key?: string) {
  const questionText = p.getByLabel('Question text', { exact: true });
  const before = await questionText.count();
  await p.getByRole('button', { name: 'Add question' }).click();
  await p.getByRole('menuitem', { name: typeLabel, exact: true }).click();
  // The new question is added by a server round trip; wait for its input to actually mount before
  // targeting ".last()", otherwise a fast test can fill the still-solitary previous question instead.
  await expect(questionText).toHaveCount(before + 1);
  const q = questionText.last();
  await q.fill(text);
  await q.blur();
  if (key) {
    await p.getByText('Advanced').last().click();
    const k = p.getByLabel('Question key').last();
    await k.fill(key);
    await k.blur();
  }
  await saved(p);
}

test('conversational form: welcome → branch → calculation → personalised ending', async ({ page, browser }) => {
  await register(page);
  const b = await blankForm(page);

  // Q1: plan (the starter multiple-choice question)
  const first = b.getByLabel('Question text', { exact: true }).first();
  await first.fill('Pick a plan');
  await first.blur();
  await b.getByRole('textbox', { name: 'Option 1' }).fill('Free');
  await b.getByRole('textbox', { name: 'Option 1' }).press('Enter');
  await b.getByRole('textbox', { name: 'Option 2' }).fill('Pro');
  await b.getByRole('textbox', { name: 'Option 2' }).blur();
  await saved(b);

  await addQuestion(b, 'Number', 'How many seats?', 'seats');
  await addQuestion(b, 'Short answer', 'Your name?', 'firstName');

  // Each screen is added by its own server round trip; wait for its title input to mount before targeting
  // it by position, otherwise a fast test can fill the previous screen's still-solitary title instead.
  const screenTitle = b.getByLabel('Screen title');
  await b.getByRole('button', { name: 'Add welcome screen' }).click();
  await expect(screenTitle).toHaveCount(1);
  await screenTitle.first().fill('Welcome to Qub');
  await screenTitle.first().blur();
  await b.getByRole('button', { name: 'Add ending' }).click();
  await expect(screenTitle).toHaveCount(2);
  await screenTitle.last().fill('Thanks {{firstName}}!');
  await screenTitle.last().blur();
  await b.getByLabel('Description', { exact: true }).last().fill('Your total is {{total}}');
  await b.getByLabel('Description', { exact: true }).last().blur();
  await saved(b);

  // Variable: total = seats × 10
  await b.getByRole('button', { name: /Variables/ }).click();
  await b.getByLabel('New variable name').fill('total');
  await b.getByRole('combobox', { name: 'New variable formula' }).fill('{{seats}} * 10');
  await b.getByRole('button', { name: 'Add variable' }).click();
  await expect(b.getByText('{{total}}', { exact: true })).toBeVisible();
  await b.keyboard.press('Escape');

  // Logic on Q1: Free skips the seats question
  await b.getByRole('region', { name: /Question Pick a plan/ }).click();
  await b.getByRole('button', { name: 'Logic' }).click();
  await b.getByRole('button', { name: 'Add rule' }).click();
  await b.getByLabel('Value 1').selectOption({ label: 'Free' });
  await b.getByLabel('Then').selectOption('JUMP_TO_FIELD');
  await b.getByLabel('Question', { exact: true }).selectOption({ label: 'Your name?' });
  await b.getByRole('button', { name: 'Save logic' }).click();
  await expect(b.getByText('Logic saved')).toBeVisible();

  // One question at a time. The radio is controlled by the settings mutation's round trip (no optimistic
  // update), so `.check()`'s single post-click verification can race it; click then wait for it to settle.
  await b.getByRole('button', { name: 'Settings' }).click();
  const conversational = b.getByLabel(/One question at a time/);
  await conversational.click();
  await expect(conversational).toBeChecked();
  await b.keyboard.press('Escape');
  await saved(b);

  await b.getByRole('button', { name: 'Publish' }).click();
  await expect(b.getByText(/Form published/)).toBeVisible();
  const liveHref = (await b.getByRole('link', { name: 'Open live form' }).getAttribute('href'))!;

  // Respondent A: Pro → seats → name
  const a = await (await browser.newContext()).newPage();
  await a.goto(liveHref);
  await expect(a.getByRole('heading', { name: 'Welcome to Qub' })).toBeVisible();
  await a.getByRole('button', { name: 'Start' }).click();
  await a.keyboard.press('b');
  await expect(a.getByText('How many seats?')).toBeVisible();
  await a.keyboard.type('3');
  await a.keyboard.press('Enter');
  await expect(a.getByText('Your name?')).toBeVisible();
  await a.keyboard.type('Ada');
  await a.keyboard.press('Enter');
  await expect(a.getByRole('heading', { name: 'Thanks Ada!' })).toBeVisible();
  await expect(a.getByText('Your total is 30')).toBeVisible();
  await a.context().close();

  // Respondent B: Free skips seats; mobile viewport
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 740 }, hasTouch: true });
  const m = await ctxB.newPage();
  await m.goto(liveHref);
  await m.getByRole('button', { name: 'Start' }).click();
  await m.getByText('Free', { exact: true }).click(); // the radio itself is visually hidden behind its label
  await expect(m.getByText('Your name?')).toBeVisible();
  await expect(m.getByText('How many seats?')).toHaveCount(0);
  await m.getByRole('textbox').fill('Bo');
  await m.getByRole('button', { name: 'Submit' }).click();
  await expect(m.getByRole('heading', { name: 'Thanks Bo!' })).toBeVisible();
  const scrollWidth = await m.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
  await ctxB.close();

  // Owner: responses, computed value and export
  await b.getByRole('link', { name: /Responses/ }).click();
  await expect(b.getByRole('heading', { name: '2 responses' })).toBeVisible();
  await b.getByRole('tab', { name: 'Individual' }).click();

  // Responses list most-recent-first (Bo submitted after Ada), so Bo's shows by default; step to Ada's.
  await expect(b.getByText(/of 2/)).toBeVisible();
  const adaAnswer = b.getByText('Ada', { exact: true });
  if (!(await adaAnswer.isVisible())) await b.getByRole('button', { name: 'Next response' }).click();
  await expect(adaAnswer).toBeVisible();
  // Ada answered seats=3, so total = seats * 10 = 30 — assert the actual stored value, not just the key.
  await expect(b.getByText('{{total}} = 30', { exact: true })).toBeVisible();

  const [download] = await Promise.all([b.waitForEvent('download'), b.getByRole('link', { name: /Download|Export/ }).first().click()]);
  const csv = await (await download.createReadStream())!.toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'));
  const lines = csv.trim().split('\n');
  const header = lines[0]!.split(',');
  const totalCol = header.indexOf('total');
  expect(totalCol).toBeGreaterThanOrEqual(0);
  const adaRow = lines.slice(1).find((line) => line.split(',').includes('Ada'));
  expect(adaRow, `no CSV row for Ada in:\n${csv}`).toBeTruthy();
  expect(adaRow!.split(',')[totalCol]).toBe('30');
});
