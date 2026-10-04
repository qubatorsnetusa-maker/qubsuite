import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';
const stamp = Date.now().toString(36);

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('V2 Builder');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);
}

const saved = (p: Page) => expect(p.getByText('All changes saved')).toBeVisible();

test('formsv2: build a form, publish it, answer it and see the result', async ({ page, browser }) => {
  await register(page, `formsv2-${stamp}@qub.test`);

  // Home -> Blank form. Unlike classic Forms' Drive "New" menu, this is a same-tab link straight into the builder.
  await page.goto('/formsv2');
  await page.getByRole('link', { name: 'Blank form' }).click();
  await expect(page).toHaveURL(/\/formsv2\/.+\/content/);
  await expect(page.getByRole('button', { name: 'Add question' })).toBeVisible();

  // A blank form starts with one starter question (multiple choice, "Untitled question"). Delete it and undo from
  // the header's Undo button (not the delete toast's own Undo, which forms-builder-ops.spec.ts already covers) to
  // prove Content-tab undo restores a deleted question.
  const starterRow = page.getByRole('button', { name: '1. Untitled question' });
  await expect(starterRow).toBeVisible();
  await page.getByRole('button', { name: 'More options for Untitled question' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(starterRow).toHaveCount(0);
  await page.getByRole('banner').getByRole('button', { name: 'Undo' }).click();
  await expect(starterRow).toBeVisible();

  // Add a Multiple choice question, rename it in place, and give it two choices inline.
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByRole('menuitem', { name: 'Multiple choice', exact: true }).click();
  const questionText = page.getByLabel('Question text', { exact: true });
  await expect(questionText).toBeVisible();
  await questionText.fill('Pick a plan');
  await questionText.blur();

  const choice1 = page.getByRole('textbox', { name: 'Choice 1' });
  await choice1.fill('Yes');
  await choice1.press('Enter'); // saves immediately and focuses the next choice
  const choice2 = page.getByRole('textbox', { name: 'Choice 2' });
  await expect(choice2).toBeVisible();
  await choice2.fill('No');
  await choice2.blur();
  await saved(page);

  // A third real question after "Pick a plan". Without this, the ending is already the default next screen and
  // the jump rule below would prove nothing (an identical result would occur with a broken/missing rule). With it,
  // the rule has to actually skip this question for the respondent to reach the ending.
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByRole('menuitem', { name: 'Short answer', exact: true }).click();
  const q3Text = page.getByLabel('Question text', { exact: true });
  await expect(q3Text).toBeVisible();
  await q3Text.fill('Anything else?');
  await q3Text.blur();
  await saved(page);

  // An ending. Always appended last regardless of the current selection, so it lands after "Anything else?".
  await page.getByRole('button', { name: 'Add ending' }).click();
  await expect(page.getByLabel('Screen title', { exact: true })).toHaveValue('Thank you!');
  await saved(page);

  // Preview: a quick visibility check of the live builder preview (full-screen respondent view; nothing recorded).
  await page.getByRole('link', { name: 'Preview', exact: true }).click();
  await expect(page.getByText(/Preview — responses are not recorded/)).toBeVisible();
  await page.getByRole('link', { name: 'Back to editing' }).click();
  await expect(page).toHaveURL(/\/formsv2\/.+\/content/);

  // Workflow: a jump rule sending "Yes" on "Pick a plan" straight to that ending, skipping "Anything else?".
  await page.getByRole('link', { name: 'Workflow', exact: true }).click();
  const planRow = page.getByRole('listitem').filter({ hasText: 'Pick a plan' });
  await planRow.getByRole('button', { name: 'Add rule' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add rule' }).click();
  await dialog.getByLabel('Value 1').selectOption({ label: 'Yes' });
  await dialog.getByLabel('Then').selectOption('END_FORM');
  await dialog.getByLabel('Ending', { exact: true }).selectOption({ label: 'Thank you!' });
  await dialog.getByRole('button', { name: 'Save logic' }).click();
  await expect(page.getByText('Logic saved')).toBeVisible();

  // Share: publish and read the public link.
  await page.getByRole('link', { name: 'Share', exact: true }).click();
  // Both the frame's header and the Share tab itself have a "Publish" button; the tab's is the one further down.
  await page.getByRole('button', { name: 'Publish' }).last().click();
  await expect(page.getByText(/Form published/)).toBeVisible();
  const publicUrl = await page.getByLabel('Public link').inputValue();

  // Respond at the public link in a fresh browser context: one question at a time. Answering "Yes" on "Pick a
  // plan" must jump straight to "Thank you!" — "Anything else?" is never shown — which only happens if the rule
  // above actually fired (the ending isn't the default next screen here; "Anything else?" is).
  const respondentContext = await browser.newContext();
  const r = await respondentContext.newPage();
  await r.goto(publicUrl);
  await expect(r.getByRole('heading', { name: 'Untitled question' })).toBeVisible();
  await r.getByRole('button', { name: 'Next' }).click(); // not required — skip without answering
  await expect(r.getByRole('heading', { name: 'Pick a plan' })).toBeVisible();
  await r.getByText('Yes', { exact: true }).click(); // choice types auto-advance after a short delay
  await expect(r.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  await expect(r.getByRole('heading', { name: 'Anything else?' })).toHaveCount(0);
  await respondentContext.close();

  // Back in Results: one response, the chosen option counted, and "Anything else?" shows nobody ever reached it —
  // the second half of the same proof that the jump rule (not the default flow) produced this response.
  await page.getByRole('link', { name: 'Results', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Responses' })).toContainText('1');
  const card = page.getByRole('region', { name: 'Pick a plan' });
  await expect(card).toContainText('1 answered');
  await expect(card).toContainText('Yes');
  await expect(card).toContainText('100%');
  const skippedCard = page.getByRole('region', { name: 'Anything else?' });
  await expect(skippedCard).toContainText('0 answered');
});
