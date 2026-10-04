import { expect, test, type Page } from '@playwright/test';

/**
 * The Design tab's Theme Settings, against the real stack. Persistence is checked the way an author
 * would see it — reload the builder, and open the respondent preview — rather than by reading the
 * API directly, so a value that saves but never renders still fails.
 */

const PASSWORD = 'e2e-Password-1';
const stamp = Date.now().toString(36);

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Design E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/drive/);
}

/** Creates a v2 form and lands on its Design tab. */
async function openDesignTab(page: Page) {
  await page.goto('/formsv2/new');
  await expect(page).toHaveURL(/\/formsv2\/[^/]+\/content/);
  const formId = new URL(page.url()).pathname.split('/')[2]!;
  await page.goto(`/formsv2/${formId}/design`);
  await expect(page.getByRole('heading', { name: 'Themes' })).toBeVisible();
  return formId;
}

/**
 * The radio inputs are screen-reader-only — a sighted user clicks the label wrapping them, so that
 * is what we click. They are also controlled, so the checked state arrives on a later render rather
 * than on the click itself, which is why `check()` is no use here.
 */
async function pickRadio(page: Page, name: string) {
  const radio = page.getByRole('radio', { name });
  await radio.locator('xpath=ancestor::label[1]').click();
  await expect(radio).toBeChecked();
}

/**
 * Autosave is debounced, so a freshly made change has not necessarily reached the API yet and the
 * status line may still read "All changes saved" from the previous write. Rather than guess at the
 * timing, reload the given URL until the saved state shows up.
 */
async function reloadUntil(page: Page, url: string, check: () => Promise<void>) {
  await expect(async () => {
    await page.goto(url);
    await check();
  }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });
}

test('Design tab — Theme Settings write through and survive a reload', async ({ page }) => {
  await register(page, `design.${stamp}@example.com`);
  const formId = await openDesignTab(page);

  // --- The live summary card reflects the theme as it changes.
  const summaryButton = page.getByTestId('theme-summary-button');
  await expect(summaryButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset to defaults' })).toBeVisible();
  await page.screenshot({ path: 'playwright-report/formsv2-design-top.png' });

  // --- A curated accent swatch commits the colour.
  await page.getByRole('button', { name: 'Emerald — #047857' }).click();
  await expect(page.getByRole('button', { name: 'Emerald — #047857' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Primary colour hex' })).toHaveValue('#047857');
  await expect(summaryButton).toHaveCSS('background-color', 'rgb(4, 120, 87)');

  // --- A curated page colour commits too.
  await page.getByRole('button', { name: 'Obsidian — #111215' }).click();
  await expect(page.getByRole('textbox', { name: 'Background colour hex' })).toHaveValue('#111215');

  // --- Font pairing: every tile carries a sample rendered in its own fonts.
  await expect(page.getByText('What is your name?')).toHaveCount(8);
  await pickRadio(page, 'Editorial');

  // --- Button shape names its radius in px, and the summary button takes it.
  await expect(page.getByText(/Softly curved — 10px/)).toBeVisible();
  await pickRadio(page, 'Sharp');
  await expect(summaryButton).toHaveCSS('border-radius', '0px');

  // --- Background: wallpapers and blur appear only once the background is an image.
  await expect(page.getByRole('button', { name: 'Atmospheric fog' })).toBeHidden();
  await pickRadio(page, 'Image');
  await page.getByRole('button', { name: 'Neon dusk' }).click();
  await expect(page.getByRole('button', { name: 'Neon dusk' })).toHaveAttribute('aria-pressed', 'true');
  await pickRadio(page, 'Medium');

  await page.screenshot({ path: 'playwright-report/formsv2-design-theme.png', fullPage: true });

  // --- Every choice above survives a reload, so it reached the API.
  const design = `/formsv2/${formId}/design`;
  await reloadUntil(page, design, async () => {
    await expect(page.getByRole('textbox', { name: 'Primary colour hex' })).toHaveValue('#047857');
    await expect(page.getByRole('textbox', { name: 'Background colour hex' })).toHaveValue('#111215');
    await expect(page.getByRole('radio', { name: 'Editorial' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Sharp' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Neon dusk' })).toHaveAttribute('aria-pressed', 'true');
  });

  // --- The blurred wallpaper reaches the respondent view.
  await page.goto(`/formsv2/${formId}/preview`);
  await expect(page.getByTestId('form-bg-image')).toHaveCSS('filter', 'blur(10px)');

  // --- Reset to defaults puts the Qub preset back.
  await page.goto(design);
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.getByRole('textbox', { name: 'Primary colour hex' })).toHaveValue('#673ab7');
  await expect(page.getByTestId('theme-preset-tiles').getByRole('button', { name: /Qub/ })).toHaveAttribute('aria-pressed', 'true');
  await reloadUntil(page, design, async () => {
    await expect(page.getByRole('textbox', { name: 'Primary colour hex' })).toHaveValue('#673ab7');
    await expect(page.getByRole('radio', { name: 'Solid' })).toBeChecked();
  });
});

test('Design tab — the branding header renders on the real form', async ({ page }) => {
  await register(page, `brand.${stamp}@example.com`);
  const formId = await openDesignTab(page);

  await page.getByLabel('Brand name').fill('Acme Inc.');
  await page.getByLabel('Brand name').blur();
  await expect(page.getByRole('switch', { name: 'Show brand name' })).toBeVisible();
  await page.getByLabel('Tagline').fill('Customer experience');
  await page.getByLabel('Tagline').blur();
  await pickRadio(page, 'Prominent');

  // The respondent view is where branding has to actually show up.
  await reloadUntil(page, `/formsv2/${formId}/preview`, async () => {
    const header = page.getByTestId('form-brand-header');
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toHaveAttribute('data-header-style', 'prominent');
    await expect(page.getByText('Acme Inc.')).toBeVisible();
    await expect(page.getByText('Customer experience')).toBeVisible();
  });
  await page.screenshot({ path: 'playwright-report/formsv2-brand-header.png', fullPage: true });
});
