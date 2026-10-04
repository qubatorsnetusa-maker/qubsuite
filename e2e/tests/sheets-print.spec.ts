import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';

/** Records what each print() call printed (the real print() still runs). */
const RECORD_PRINTS = () => {
  const w = window as unknown as { __prints: string[] };
  w.__prints = [];
  const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')!;
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get(this: HTMLIFrameElement) {
      const win = desc.get!.call(this) as (Window & { __wrapped?: boolean }) | null;
      if (win && !win.__wrapped) {
        win.__wrapped = true;
        const real = win.print.bind(win);
        win.print = () => {
          w.__prints.push(win.document.body.innerText);
          real();
        };
      }
      return win;
    },
  });
};

async function newSpreadsheet(page: Page) {
  // On the context: the spreadsheet opens in a new tab.
  await page.context().addInitScript(RECORD_PRINTS);
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Print E2E');
  await page.getByLabel('Email').fill(`print.${Date.now().toString(36)}@example.com`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);
  await page.getByRole('button', { name: 'New' }).click();
  const [sheet] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('menuitem', { name: 'Qub Sheets' }).click()]);
  await sheet.getByRole('link', { name: 'Blank spreadsheet' }).click();
  await expect(sheet).toHaveURL(/\/sheets\/[0-9a-f-]{36}$/);
  return sheet;
}

const prints = (p: Page) => p.evaluate(() => (window as unknown as { __prints: string[] }).__prints);

test('Sheets: print sends only the sheet to the printer, from the toolbar, File menu and Ctrl+P', async ({ page }) => {
  const s = await newSpreadsheet(page);
  for (const [ref, text] of [['0:0', 'Item'], ['0:1', 'Cost'], ['1:0', 'Paint'], ['1:1', '42']] as const) {
    await s.locator(`[data-cell="${ref}"]`).first().click();
    await s.keyboard.type(text);
    await s.keyboard.press('Enter');
  }

  await s.getByRole('button', { name: 'Print (Ctrl+P)' }).click();
  await expect.poll(() => prints(s)).toHaveLength(1);
  const [printed] = await prints(s);
  expect(printed!.replace(/\s+/g, ' ').trim()).toBe('Item Cost Paint 42');
  // The print frame goes away once printing is done.
  await expect(s.locator('iframe[title="Print"]')).toHaveCount(0);

  await s.getByRole('button', { name: 'File' }).click();
  await s.getByRole('menuitem', { name: 'Print' }).click();
  await expect.poll(() => prints(s)).toHaveLength(2);

  await s.locator('[data-cell="3:3"]').first().click();
  await s.keyboard.press('Control+p');
  await expect.poll(() => prints(s)).toHaveLength(3);
  expect((await prints(s))[2]).toContain('Paint');
});
