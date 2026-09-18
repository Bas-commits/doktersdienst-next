import { test, expect } from '@playwright/test';

const secretarisEmail = process.env.PLAYWRIGHT_SECRETARIS_EMAIL;
const secretarisPassword = process.env.PLAYWRIGHT_SECRETARIS_PASSWORD;

test.skip(
  !secretarisEmail || !secretarisPassword,
  'Set PLAYWRIGHT_SECRETARIS_EMAIL and PLAYWRIGHT_SECRETARIS_PASSWORD to run this suite.'
);

// Test10 (id 78) is the dedicated e2e-fixture waarneemgroep with shift data spanning years
// ahead. A fresh (storage-less) session otherwise defaults to the first waarneemgroep in the
// whole system, which this account isn't even a member of, so the calendar stays empty.
const TEST_WAARNEEMGROEP_ID = '78';

// The calendar's visible month always includes a few padding days before "today"; shift blocks
// on those days are ended and inert (no click handler at all — see ShiftBlock.tsx's `isEnded`
// gate), so `.first()` can silently no-op. Pick a block that has actually started in the future.
//
// data-current-date is NOT unique: a shift that crosses midnight renders as two adjacent day
// cells (one per calendar date) that both carry the shift's own start time as data-current-date.
// `.first()` on the resulting locator resolves that the same way `evaluate`'s loop already did
// (first in document order), so it stays pointed at the exact element that was found.
async function futureShiftBlockLocator(page: import('@playwright/test').Page) {
  const currentDate = await page.evaluate(() => {
    const now = Date.now();
    const blocks = document.querySelectorAll('[data-testid="shift-block-middle"]');
    for (const el of Array.from(blocks)) {
      const raw = el.getAttribute('data-current-date');
      if (!raw) continue;
      if (new Date(raw.replace(' ', 'T')).getTime() > now) return raw;
    }
    return null;
  });
  if (!currentDate) throw new Error('No shift block with a future start time found');
  return {
    locator: page.locator(`[data-testid="shift-block-middle"][data-current-date="${currentDate}"]`).first(),
    currentDate: currentDate as string,
  };
}

async function futureShiftBlockIndex(page: import('@playwright/test').Page): Promise<number> {
  const index = await page.evaluate(() => {
    const now = Date.now();
    const blocks = Array.from(document.querySelectorAll('[data-testid="shift-block-middle"]'));
    return blocks.findIndex((el) => {
      const raw = el.getAttribute('data-current-date');
      return raw != null && new Date(raw.replace(' ', 'T')).getTime() > now;
    });
  });
  if (index < 0) throw new Error('No shift block with a future start time found');
  return index;
}

test.describe('Voorkeuren', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(secretarisEmail!);
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(secretarisPassword!);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/rooster-inzien');
    // Selecting fires the header's own router.reload(); wait for it to settle before navigating
    // away ourselves, otherwise the two navigations race and the group pick can get lost.
    await page.getByTestId('header-group-select').selectOption(TEST_WAARNEEMGROEP_ID);
    await page.waitForLoadState('networkidle');
    await page.goto('/voorkeuren');
    await expect(page.getByRole('heading', { name: 'Voorkeuren' })).toBeVisible();
  });

  test('page shows heading, chip selector, and calendar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Voorkeuren' })).toBeVisible();

    // Chip selector buttons are visible
    for (const label of ['Liever wel', 'Liever niet', 'Vakantie', 'Nascholing', 'FTE', 'Weghalen']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    // Chip labels are visible (scoped to main to avoid nav matches)
    const main = page.getByRole('main');
    for (const label of ['Liever wel', 'Liever niet', 'Vakantie', 'Nascholing', 'FTE', 'Weghalen']) {
      await expect(main.getByText(label)).toBeVisible();
    }

    // Calendar day headers. exact: true avoids matching the welcome banner's
    // "Laatste build: woensdag ..." text whenever "today" falls on the day a header names.
    for (const day of ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']) {
      await expect(page.getByText(day, { exact: true })).toBeVisible();
    }

    // Month navigation
    await expect(page.getByRole('navigation', { name: 'Maandnavigatie' })).toBeVisible();

    // Shift blocks load
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });
  });

  test('selecting a chip toggles aria-pressed', async ({ page }) => {
    const lieverWelBtn = page.getByRole('button', { name: 'Liever wel' });
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'false');

    // Select chip
    await lieverWelBtn.click();
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'true');

    // Deselect via Escape
    await page.keyboard.press('Escape');
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('selecting a different chip deselects the previous one', async ({ page }) => {
    const lieverWelBtn = page.getByRole('button', { name: 'Liever wel' });
    const vakantieBtn = page.getByRole('button', { name: 'Vakantie' });

    await lieverWelBtn.click();
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(vakantieBtn).toHaveAttribute('aria-pressed', 'false');

    await vakantieBtn.click();
    await expect(vakantieBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('escape key deselects the active chip', async ({ page }) => {
    const lieverWelBtn = page.getByRole('button', { name: 'Liever wel' });
    await lieverWelBtn.click();
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Escape');
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('month navigation works', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Volgende maand' }).click();
    await expect(page.getByText('Maandag')).toBeVisible();
    await expect(page.getByText(/^Week \d+$/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Vorige maand' }).click();
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });
  });

  test('can add and then remove a preference on a shift block', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    // Select "Liever wel" chip
    const lieverWelBtn = page.getByRole('button', { name: 'Liever wel' });
    await lieverWelBtn.click();
    await expect(lieverWelBtn).toHaveAttribute('aria-pressed', 'true');

    // Click a future shift block to add the preference, wait for API response
    const { locator: firstBlock } = await futureShiftBlockLocator(page);
    const addResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/preference') && r.request().method() === 'POST'
    );
    await firstBlock.click();
    await addResponse;

    // The block should get a title and green background. Test10's slots carry an aantekening
    // (e.g. "Dagdnst") appended to the title, so match the prefix rather than the exact string.
    await expect(firstBlock).toHaveAttribute('title', /^Liever wel/, { timeout: 5_000 });
    await expect(firstBlock).toHaveCSS('background-color', 'rgb(34, 197, 94)');

    // --- Cleanup: remove the preference ---
    await page.keyboard.press('Escape');
    const weghalenBtn = page.getByRole('button', { name: 'Weghalen' });
    await weghalenBtn.click();
    await expect(weghalenBtn).toHaveAttribute('aria-pressed', 'true');

    // Click the same block to remove, wait for API response
    const removeResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/preference') && r.request().method() === 'POST'
    );
    await firstBlock.click();
    await removeResponse;

    // The green background should be gone
    await expect(firstBlock).not.toHaveCSS('background-color', 'rgb(34, 197, 94)', { timeout: 5_000 });
  });

  test('removing a preference after page refresh returns block to empty state', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    // Step 1: Add a preference
    const lieverWelBtn = page.getByRole('button', { name: 'Liever wel' });
    await lieverWelBtn.click();

    const { locator: firstBlock, currentDate } = await futureShiftBlockLocator(page);
    const addResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/preference') && r.request().method() === 'POST'
    );
    await firstBlock.click();
    await addResponse;
    await expect(firstBlock).toHaveCSS('background-color', 'rgb(34, 197, 94)');

    // Step 2: Refresh the page so the preference comes from the server (not pendingInsert)
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Voorkeuren' })).toBeVisible();

    // Wait for the preference to load from server (user diensten load async after shift blocks).
    // Test10's slots carry an aantekening suffix on the title (e.g. "Liever wel — Dagdnst"), so
    // match on prefix rather than exact value.
    const preferenceBlock = page.locator('[data-testid="shift-block-middle"][title^="Liever wel"]');
    await expect(preferenceBlock.first()).toBeVisible({ timeout: 10_000 });
    await expect(preferenceBlock.first()).toHaveCSS('background-color', 'rgb(34, 197, 94)');

    // Step 3: Remove the preference
    const weghalenBtn = page.getByRole('button', { name: 'Weghalen' });
    await weghalenBtn.click();

    const removeResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/preference') && r.request().method() === 'POST'
    );
    await preferenceBlock.first().click();
    await removeResponse;

    // The block should return to a plain empty state: no colored background, no doctor initials
    const reloadedFirst = page
      .locator(`[data-testid="shift-block-middle"][data-current-date="${currentDate}"]`)
      .first();
    await expect(reloadedFirst).not.toHaveCSS('background-color', 'rgb(34, 197, 94)', { timeout: 5_000 });
    // data-doctor="0" means no doctor assigned (empty slot)
    await expect(reloadedFirst).toHaveAttribute('data-doctor', '0');
  });

  test('can add each preference type and clean up', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    const preferences = [
      { label: 'Liever wel', color: 'rgb(34, 197, 94)' },
      { label: 'Liever niet', color: 'rgb(234, 179, 8)' },
      { label: 'Vakantie', color: 'rgb(239, 68, 68)' },
      { label: 'Nascholing', color: 'rgb(168, 85, 247)' },
      { label: 'FTE', color: 'rgb(100, 116, 139)' },
    ];

    // Add each preference type to consecutive, still-future shift blocks
    const startIndex = await futureShiftBlockIndex(page);
    for (let i = 0; i < preferences.length; i++) {
      const { label, color } = preferences[i];
      const block = shiftBlocks.nth(startIndex + i);

      // Deselect previous chip first (for i > 0)
      if (i > 0) await page.keyboard.press('Escape');

      // Select the preference chip
      await page.getByRole('button', { name: label }).click();

      // Click the shift block and wait for the API response
      const response = page.waitForResponse(
        (r) => r.url().includes('/api/diensten/preference') && r.request().method() === 'POST'
      );
      await block.click();
      await response;

      // Verify the preference was applied. Test10's slots carry an aantekening suffix on the
      // title (e.g. "Liever wel — Dagdnst"), so match the prefix rather than the exact string.
      await expect(block).toHaveAttribute('title', new RegExp(`^${label}`), { timeout: 5_000 });
      await expect(block).toHaveCSS('background-color', color);
    }

    // --- Cleanup: remove all preferences ---
    await page.keyboard.press('Escape');
    const weghalenBtn = page.getByRole('button', { name: 'Weghalen' });
    await weghalenBtn.click();
    await expect(weghalenBtn).toHaveAttribute('aria-pressed', 'true');

    for (let i = 0; i < preferences.length; i++) {
      const block = shiftBlocks.nth(startIndex + i);
      const response = page.waitForResponse(
        (r) => r.url().includes('/api/diensten/preference') && r.request().method() === 'POST'
      );
      await block.click();
      await response;
      await expect(block).not.toHaveCSS('background-color', preferences[i].color, { timeout: 5_000 });
    }
  });

  test('clicking a shift block without a chip selected does nothing', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    const { locator: firstBlock } = await futureShiftBlockLocator(page);
    const titleBefore = await firstBlock.getAttribute('title');
    await firstBlock.click();

    const titleAfter = await firstBlock.getAttribute('title');
    expect(titleAfter).toBe(titleBefore);
  });
});
