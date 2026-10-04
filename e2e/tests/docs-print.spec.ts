import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';

/** Records what each print() call printed (the real print() still runs). */
const RECORD_PRINTS = () => {
  const w = window as unknown as { __prints: { text: string; html: string }[] };
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
          w.__prints.push({ text: win.document.body.innerText, html: win.document.documentElement.outerHTML });
          real();
        };
      }
      return win;
    },
  });
};

const prints = (p: Page) => p.evaluate(() => (window as unknown as { __prints: { text: string; html: string }[] }).__prints);

test('Docs: print sends only the document to the printer, from the toolbar, File menu and Ctrl+P', async ({ page }) => {
  await page.context().addInitScript(RECORD_PRINTS);
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Docs Print E2E');
  await page.getByLabel('Email').fill(`docprint.${Date.now().toString(36)}@example.com`);
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
  await doc.keyboard.type('Trip plan', { delay: 30 });
  await doc.keyboard.press('Enter');
  await doc.keyboard.type('Pack light.', { delay: 30 });
  await doc.keyboard.press('Control+Enter');
  await doc.keyboard.type('Second page', { delay: 30 });
  await expect(body).toContainText('Second page');

  await doc.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => prints(doc)).toHaveLength(1);
  const [first] = await prints(doc);
  expect(first!.text.replace(/\s+/g, ' ').trim()).toBe('Trip plan Pack light. Second page');
  // Only the document: none of the app's menus, toolbar or panels.
  for (const chrome of ['File', 'Share', 'Normal text', 'Comments', 'Version history']) expect(first!.text).not.toContain(chrome);
  // The manual page break starts a new printed page.
  expect(first!.html).toMatch(/class="qub-manual-break"/);
  expect(first!.html).toContain('break-after:page');
  await expect(doc.locator('iframe[title="Print"]')).toHaveCount(0);

  await doc.getByRole('button', { name: 'File' }).click();
  await doc.getByRole('menuitem', { name: 'Print' }).click();
  await expect.poll(() => prints(doc)).toHaveLength(2);

  await body.click();
  await doc.keyboard.press('Control+p');
  await expect.poll(() => prints(doc)).toHaveLength(3);
  expect((await prints(doc))[2]!.text).toContain('Pack light.');
});
