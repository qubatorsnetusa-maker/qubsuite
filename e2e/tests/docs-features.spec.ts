import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';

test('Docs: find & replace, checklist, word count, outline and Markdown download', async ({ page }) => {
  const email = `docs.${Date.now().toString(36)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Docs E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);

  await page.getByRole('button', { name: 'New' }).click();
  const [doc] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('menuitem', { name: 'Qub Docs' }).click()]);
  await doc.getByRole('link', { name: 'Blank document' }).click();
  await expect(doc).toHaveURL(/\/docs\/[0-9a-f-]{36}$/);

  const body = doc.getByLabel('Document body');
  await expect(body).toHaveAttribute('contenteditable', 'true');
  await body.click();
  await doc.keyboard.type('alpha beta alpha');

  // Find & replace
  await doc.keyboard.press('Control+h');
  await doc.getByLabel('Find in document').fill('alpha');
  await expect(doc.getByText('1 of 2')).toBeVisible();
  await doc.getByLabel('Replace with').fill('gamma');
  await doc.getByRole('button', { name: 'Replace all' }).click();
  await expect(body).toContainText('gamma beta gamma');
  await doc.getByRole('button', { name: 'Close find' }).click();

  // Checklist
  await body.click();
  await doc.keyboard.press('Control+End');
  await doc.keyboard.press('Enter');
  await doc.getByRole('button', { name: 'Checklist' }).click();
  await doc.keyboard.type('Buy milk');
  const box = body.locator('ul[data-type="taskList"] > li input[type="checkbox"]');
  await box.check();
  await expect(box).toBeChecked();

  // Line spacing from the toolbar menu; typing afterwards must still go into the document
  await doc.getByRole('button', { name: 'Line spacing' }).click();
  await doc.getByRole('menuitem', { name: 'Double' }).click();
  await doc.keyboard.type(' today');
  await expect(body.locator('p[style*="line-height: 2"]')).toContainText('Buy milk today');

  // Insert menu action; focus returns to the document too
  await doc.getByRole('button', { name: 'Insert', exact: true }).click();
  await doc.getByRole('menuitem', { name: 'Horizontal line' }).click();
  await doc.keyboard.type('After rule');
  await expect(body).toContainText('After rule');

  // Word count: 8 words (gamma beta gamma Buy milk today After rule) — checklist markers don't count
  await doc.keyboard.press('Control+Shift+C');
  const dialog = doc.getByRole('dialog', { name: 'Word count' });
  await expect(dialog.getByRole('row', { name: /^Words\s+8$/ })).toBeVisible();
  await doc.keyboard.press('Escape');

  // A heading appears in the outline
  await body.click();
  await doc.keyboard.press('Control+Home');
  await doc.keyboard.press('Enter');
  await doc.keyboard.press('ArrowUp');
  await doc.getByLabel('Text style').selectOption('2');
  await doc.keyboard.type('Shopping');
  await doc.getByRole('button', { name: 'View' }).click();
  await doc.getByRole('menuitemcheckbox', { name: 'Show outline' }).click();
  await expect(doc.getByRole('complementary', { name: 'Document outline' }).getByRole('button', { name: 'Shopping' })).toBeVisible();

  // Markdown download reflects the document
  await doc.getByRole('button', { name: 'File' }).click();
  await doc.getByRole('menuitem', { name: 'Download' }).hover();
  const [download] = await Promise.all([doc.waitForEvent('download'), doc.getByRole('menuitem', { name: 'Markdown (.md)' }).click()]);
  const md = await readFile((await download.path())!, 'utf8');
  expect(md).toContain('## Shopping');
  expect(md).toContain('gamma beta gamma');
  expect(md).toContain('- [x] Buy milk today');

  // Everything persisted
  await expect(doc.getByText(/All changes saved|Saved /)).toBeVisible();
  await doc.reload();
  const reloaded = doc.getByLabel('Document body');
  await expect(reloaded).toContainText('gamma beta gamma');
  await expect(reloaded).toContainText('Shopping');
  await expect(reloaded.locator('ul[data-type="taskList"] > li input[type="checkbox"]')).toBeChecked();
});
