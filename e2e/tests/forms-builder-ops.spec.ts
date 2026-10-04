import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';
const stamp = Date.now().toString(36);

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Ops Builder');
  await page.getByLabel('Email').fill(email);
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

test('builder edits can be undone, redone and survive a reload', async ({ page }) => {
  await register(page, `ops-${stamp}@qub.test`);
  const b = await blankForm(page);

  const questionText = b.getByLabel('Question text', { exact: true });
  const first = questionText.first();
  await first.fill('What is your name?');
  await first.blur();
  await saved(b);

  for (const label of ['Q2', 'Q3', 'Q4']) {
    const count = await questionText.count();
    await b.getByRole('button', { name: 'Add question' }).click();
    await b.getByRole('menuitem', { name: 'Short answer', exact: true }).click();
    await expect(questionText).toHaveCount(count + 1);
    const box = questionText.nth(count);
    await box.fill(label);
    await box.blur();
  }
  await saved(b);

  const undo = b.getByRole('button', { name: 'Undo' });
  const redo = b.getByRole('button', { name: 'Redo' });
  // Undo: Q4 text, add Q4, Q3 text.
  await undo.click();
  await undo.click();
  await undo.click();
  await expect(questionText).toHaveCount(3);
  await redo.click();
  await expect(questionText.nth(2)).toHaveValue('Q3');
  await saved(b);

  await b.reload();
  await expect(questionText).toHaveCount(3);
  await expect(questionText.nth(2)).toHaveValue('Q3');

  // Delete with undo toast. The Delete button only renders on the active question.
  await questionText.nth(2).click();
  await b.getByRole('button', { name: 'Delete' }).click();
  await expect(questionText).toHaveCount(2);
  await b.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' }).click();
  await expect(questionText).toHaveCount(3);
});

test('edits made offline are kept and saved when the connection returns', async ({ page, context }) => {
  await register(page, `ops-offline-${stamp}@qub.test`);
  const b = await blankForm(page);
  const questionText = b.getByLabel('Question text', { exact: true }).first();
  await expect(questionText).toBeVisible();

  await context.setOffline(true);
  await questionText.fill('Typed while offline');
  await questionText.blur();
  await expect(b.getByText('Offline — changes kept on this device')).toBeVisible();

  await context.setOffline(false);
  // Nudge the app's own online handling rather than waiting on a timer.
  await b.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(b.getByText('All changes saved')).toBeVisible({ timeout: 40_000 });

  await b.reload();
  await expect(b.getByLabel('Question text', { exact: true }).first()).toHaveValue('Typed while offline');
});
