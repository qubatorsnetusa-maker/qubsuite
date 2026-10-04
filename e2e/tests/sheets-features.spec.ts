import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';

async function newSpreadsheet(page: Page) {
  const email = `sheets.${Date.now().toString(36)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Sheets E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);
  await page.getByRole('button', { name: 'New' }).click();
  const [sheet] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('menuitem', { name: 'Qub Sheets' }).click()]);
  await sheet.getByRole('link', { name: 'Blank spreadsheet' }).click();
  await expect(sheet).toHaveURL(/\/sheets\/[0-9a-f-]{36}$/);
  return sheet;
}

const cell = (p: Page, ref: string) => {
  const col = ref.charCodeAt(0) - 65;
  const row = Number(ref.slice(1)) - 1;
  return p.locator(`[data-cell="${row}:${col}"]`).first();
};

async function type(p: Page, ref: string, text: string) {
  await cell(p, ref).click();
  await p.keyboard.type(text);
  await p.keyboard.press('Enter');
}

test('Sheets: dates, lookups, autofill, find & replace, checkbox and CSV round trip', async ({ page }) => {
  const s = await newSpreadsheet(page);

  // Dates and date functions
  await type(s, 'A1', '2026-09-27');
  await expect(cell(s, 'A1')).toHaveText('2026-09-27');
  await type(s, 'B1', '=YEAR(A1)');
  await expect(cell(s, 'B1')).toHaveText('2026');

  // VLOOKUP over a small table
  await type(s, 'D1', 'apple');
  await type(s, 'E1', '10');
  await type(s, 'D2', 'pear');
  await type(s, 'E2', '20');
  await type(s, 'F1', '=VLOOKUP("pear", D1:E2, 2, FALSE)');
  await expect(cell(s, 'F1')).toHaveText('20');

  // Autofill a series by dragging the handle
  await type(s, 'H1', '1');
  await type(s, 'H2', '2');
  await cell(s, 'H1').click();
  await cell(s, 'H2').click({ modifiers: ['Shift'] });
  const handle = s.getByTestId('autofill-handle');
  const target = await cell(s, 'H5').boundingBox();
  await handle.hover();
  await s.mouse.down();
  await s.mouse.move(target!.x + 5, target!.y + 5, { steps: 8 });
  await s.mouse.up();
  await expect(cell(s, 'H5')).toHaveText('5');

  // Find & replace all, then undo
  await cell(s, 'A1').click();
  await s.keyboard.press('Control+h');
  await s.getByLabel('Find', { exact: true }).fill('apple');
  await expect(s.getByText('1 of 1')).toBeVisible();
  await s.getByLabel('Replace with').fill('plum');
  await s.getByRole('button', { name: 'Replace all' }).click();
  await expect(cell(s, 'D1')).toHaveText('plum');
  await s.getByRole('button', { name: 'Close find' }).click();
  await s.keyboard.press('Control+z');
  await expect(cell(s, 'D1')).toHaveText('apple');

  // Checkbox validation + COUNTIF
  await cell(s, 'J1').click();
  await cell(s, 'J3').click({ modifiers: ['Shift'] });
  await s.getByRole('button', { name: 'Data' }).click();
  await s.getByRole('menuitem', { name: /Data validation/ }).click();
  await s.getByRole('radio', { name: 'Checkbox' }).check();
  await s.getByRole('button', { name: 'Save' }).click();
  await s.getByLabel('Checkbox J2').click();
  await type(s, 'K1', '=COUNTIF(J1:J3, TRUE)');
  await expect(cell(s, 'K1')).toHaveText('1');

  // CSV download, then re-import as a new sheet
  await s.getByRole('button', { name: 'File' }).click();
  await s.getByRole('menuitem', { name: 'Download' }).hover();
  const [download] = await Promise.all([s.waitForEvent('download'), s.getByRole('menuitem', { name: /Comma-separated values/ }).click()]);
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv).toContain('2026-09-27,2026');
  await s.getByRole('button', { name: 'File' }).click();
  await s.getByRole('menuitem', { name: /Import/ }).click();
  await s.getByLabel('CSV file').setInputFiles({ name: 'roundtrip.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await s.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(s.getByRole('tab', { name: /roundtrip/ })).toBeVisible();
  await expect(cell(s, 'A1')).toHaveText('2026-09-27');
  await expect(cell(s, 'D1')).toHaveText('apple');
});

test('Sheets: after jumping with the name box, typing goes into the cell', async ({ page }) => {
  const s = await newSpreadsheet(page);
  const box = s.getByLabel('Name box (go to cell)');
  await box.fill('C30');
  await box.press('Enter');
  await s.keyboard.type('landed');
  await s.keyboard.press('Enter');
  await expect(cell(s, 'C30')).toHaveText('landed');
  await expect(box).toHaveValue('C31');
});
