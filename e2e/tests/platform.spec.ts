import { expect, test, type Browser, type Page } from '@playwright/test';

const PASSWORD = 'e2e-Password-1';
const stamp = Date.now().toString(36);

async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);
}

async function login(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/drive/);
  return page;
}

/** Row in the Drive list/grid by exact item name. */
const item = (page: Page, name: string) => page.locator('[role="row"],[role="gridcell"]').filter({ has: page.getByText(name, { exact: true }) }).first();

const APP = {
  'Qub Docs': { home: /\/docs(\?|$)/, noun: 'document' },
  'Qub Sheets': { home: /\/sheets(\?|$)/, noun: 'spreadsheet' },
  'Qub Forms': { home: /\/forms(\?|$)/, noun: 'form' },
} as const;

/** New → Qub Docs/Sheets/Forms opens the app's home page in a new tab; "Blank …" there creates the file. */
async function createFromNewMenu(page: Page, label: keyof typeof APP) {
  await page.getByRole('button', { name: 'New' }).click();
  const [tab] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('menuitem', { name: label }).click()]);
  await expect(tab).toHaveURL(APP[label].home);
  await expect(tab.getByRole('heading', { name: `Start a new ${APP[label].noun}` })).toBeVisible();
  await tab.getByRole('link', { name: `Blank ${APP[label].noun}` }).click();
  return tab;
}

test('Qub end-to-end: drive, docs, sharing, sheets and forms', async ({ page, browser }) => {
  const alice = `alice.${stamp}@example.com`;
  const bob = `bob.${stamp}@example.com`;

  // Register Bob (so he can be shared with), then Alice.
  await register(page, 'Bob E2E', bob);
  await page.getByRole('button', { name: /Account:/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  // Register → Login
  await register(page, 'Alice E2E', alice);
  await page.getByRole('button', { name: /Account:/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill(alice);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Drive' }).or(page.getByText('My Drive').first()).first()).toBeVisible();

  // Create folder
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByLabel('Folder name').fill('Projects');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(item(page, 'Projects')).toBeVisible();

  // Create document → opens the editor in a new tab; the Drive tab stays put and lists the new file.
  const docPage = await createFromNewMenu(page, 'Qub Docs');
  await expect(docPage).toHaveURL(/\/docs\/[0-9a-f-]{36}$/);
  await expect(page).toHaveURL(/\/drive$/);
  await expect(item(page, 'Untitled document')).toBeVisible();
  const docUrl = docPage.url();
  await docPage.getByLabel('Title', { exact: true }).fill('E2E Plan');
  await docPage.getByLabel('Title', { exact: true }).press('Enter');

  // Edit document (real-time, persisted by the server)
  const editor = docPage.locator('.ProseMirror');
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  await editor.click();
  await docPage.keyboard.type('Written by Alice in the E2E test.');
  await expect(docPage.getByText(/Saved/)).toBeVisible({ timeout: 15_000 });

  // Move document into the folder (File → Move)
  await docPage.getByRole('button', { name: 'File' }).click();
  await docPage.getByRole('menuitem', { name: 'Move', exact: true }).click();
  await docPage.getByRole('dialog').getByRole('button', { name: 'Projects' }).click();
  await docPage.getByRole('button', { name: 'Move here' }).click();
  await expect(docPage.getByText(/Moved "E2E Plan" to "Projects"/)).toBeVisible();

  // Share document with Bob as editor
  await docPage.getByRole('button', { name: 'Share' }).click();
  await docPage.getByLabel('Email address').fill(bob);
  await docPage.getByLabel('Role for new person').selectOption('EDITOR');
  await docPage.getByRole('button', { name: 'Send' }).click();
  await expect(docPage.getByRole('dialog').getByText('Bob E2E')).toBeVisible();
  await docPage.keyboard.press('Escape');

  // Bob sees it under "Shared with me" and collaborates in real time.
  const bobPage = await login(browser, bob);
  await bobPage.goto('/drive/shared');
  await expect(item(bobPage, 'E2E Plan')).toBeVisible();
  await bobPage.goto(docUrl);
  await expect(bobPage.locator('.ProseMirror')).toContainText('Written by Alice');
  await bobPage.locator('.ProseMirror').click();
  await bobPage.keyboard.press('Control+End');
  await bobPage.keyboard.type(' Bob was here.');
  await expect(editor).toContainText('Bob was here.', { timeout: 15_000 });
  await bobPage.context().close();
  await docPage.close();

  // Back on the Drive tab, the listing reflects the rename/move made in the editor tab.
  // Headless tabs never change visibility, so emit the event a real browser fires when the user switches back.
  await page.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
  await expect(item(page, 'Untitled document')).toBeHidden();

  // Create spreadsheet from inside the folder → it's created there, in a new tab.
  await item(page, 'Projects').dblclick();
  await expect(page).toHaveURL(/\/drive\/folder\//);
  const sheetPage = await createFromNewMenu(page, 'Qub Sheets');
  await expect(sheetPage).toHaveURL(/\/sheets\/[0-9a-f-]{36}$/);
  await expect(item(page, 'Untitled spreadsheet')).toBeVisible();
  const grid = sheetPage.getByRole('grid', { name: /Sheet Sheet1/ });
  await sheetPage.locator('[data-cell="0:0"]').click();
  await sheetPage.keyboard.type('10');
  await sheetPage.keyboard.press('Enter');
  await sheetPage.keyboard.type('20');
  await sheetPage.keyboard.press('Enter');
  await sheetPage.keyboard.type('=SUM(A1:A2)');
  await sheetPage.keyboard.press('Enter');
  await expect(sheetPage.locator('[data-cell="2:0"]')).toHaveText('30');
  // Dependency tracking: changing A1 recalculates A3.
  await sheetPage.locator('[data-cell="0:0"]').click();
  await sheetPage.keyboard.type('15');
  await sheetPage.keyboard.press('Enter');
  await expect(sheetPage.locator('[data-cell="2:0"]')).toHaveText('35');
  await expect(grid).toBeVisible();
  await sheetPage.close();

  // Create form → add a question → publish
  const formPage = await createFromNewMenu(page, 'Qub Forms');
  await expect(formPage).toHaveURL(/\/forms\/.+\/edit/);
  const question = formPage.getByLabel('Question text', { exact: true }).first();
  await question.fill('Favorite color?');
  await question.blur();
  await formPage.getByRole('textbox', { name: 'Option 1' }).fill('Blue');
  await formPage.getByRole('textbox', { name: 'Option 1' }).press('Enter');
  await formPage.getByRole('textbox', { name: 'Option 2' }).fill('Green');
  await formPage.getByRole('textbox', { name: 'Option 2' }).blur();
  await expect(formPage.getByText('All changes saved')).toBeVisible();
  await formPage.getByRole('button', { name: 'Publish' }).click();
  await expect(formPage.getByText(/Form published/)).toBeVisible();
  const liveHref = await formPage.getByRole('link', { name: 'Open live form' }).getAttribute('href');
  expect(liveHref).toMatch(/\/forms\/.+\/fill/);

  // Submit form as an anonymous respondent
  const respondent = await (await browser.newContext()).newPage();
  await respondent.goto(liveHref!);
  await respondent.getByRole('radio', { name: 'Green' }).check();
  await respondent.getByRole('button', { name: 'Submit' }).click();
  await expect(respondent.getByText('Your response has been recorded.')).toBeVisible();
  await respondent.context().close();

  // View responses: analytics computed from the stored answer
  await formPage.getByRole('link', { name: /Responses/ }).click();
  await expect(formPage.getByRole('heading', { name: '1 response' })).toBeVisible();
  await expect(formPage.getByRole('cell', { name: 'Green' })).toBeVisible();
  await expect(formPage.getByRole('cell', { name: '100%' })).toBeVisible();
});
