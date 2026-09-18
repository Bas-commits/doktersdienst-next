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

test.describe('Rooster inzien', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(secretarisEmail!);
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(secretarisPassword!);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/rooster-inzien');
    await expect(page.getByRole('heading', { name: /Welkom/ })).toBeVisible();
    // Selecting fires the header's own router.reload(); wait for it to settle before the test's
    // own assertions run, otherwise they race the reload and see stale/half-loaded state.
    await page.getByTestId('header-group-select').selectOption(TEST_WAARNEEMGROEP_ID);
    await page.waitForLoadState('networkidle');
    // For an account with a large waarneemgroep footprint (e.g. a global admin), the reload can
    // still momentarily bounce the active group back to the system-wide default even after the
    // explicit selection above. Poll and re-select rather than trusting a single wait.
    await expect(async () => {
      let value = await page.getByTestId('header-group-select').inputValue();
      if (value !== TEST_WAARNEEMGROEP_ID) {
        await page.getByTestId('header-group-select').selectOption(TEST_WAARNEEMGROEP_ID);
        await page.waitForLoadState('networkidle');
        value = await page.getByTestId('header-group-select').inputValue();
      }
      expect(value).toBe(TEST_WAARNEEMGROEP_ID);
    }).toPass({ timeout: 15_000 });
    // The waarneemgroep checkboxes live behind this collapsed filter toggle.
    await page.getByRole('button', { name: 'Filter waarneemgroepen' }).click();
  });

  test('calendar is displayed with shift blocks after login', async ({ page }) => {
    // The active waarneemgroep (Test10) checkbox should be checked by default
    const firstCheckbox = page.getByRole('checkbox', { name: /Test10/ });
    await expect(firstCheckbox).toBeChecked();

    // Calendar day headers should be visible. exact: true avoids matching the welcome banner's
    // "Laatste build: woensdag 16 september 2026..." text whenever "today" happens to fall on
    // the day a header names (a plain substring match caught both).
    for (const day of ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']) {
      await expect(page.getByText(day, { exact: true })).toBeVisible();
    }

    // Month navigation should be present
    await expect(page.getByRole('navigation', { name: 'Maandnavigatie' })).toBeVisible();

    // Week labels should be rendered
    await expect(page.getByText(/^Week \d+$/).first()).toBeVisible();

    // The loading message should NOT be visible (data has loaded)
    await expect(page.getByText('Rooster laden…')).not.toBeVisible();

    // Shift blocks should be rendered (middle section = main doctor slot)
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });
    expect(await shiftBlocks.count()).toBeGreaterThan(0);
  });

  test('checking additional waarneemgroepen adds their shifts to the calendar', async ({ page }) => {
    // Wait for shift blocks from the default (first) waarneemgroep to appear
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    // Count shift blocks with only the first waarneemgroep selected
    const initialBlockCount = await shiftBlocks.count();

    // The active waarneemgroep should be checked, others unchecked
    const firstCheckbox = page.getByRole('checkbox', { name: /Test10/ });
    await expect(firstCheckbox).toBeChecked();

    // Pick a second (test) waarneemgroep and check it
    const secondCheckbox = page.getByRole('checkbox', { name: /Test09/ });
    await expect(secondCheckbox).not.toBeChecked();
    await secondCheckbox.check();
    await expect(secondCheckbox).toBeChecked();

    // Wait for additional shift blocks to appear
    await page.waitForTimeout(1000);
    const afterSecondCount = await shiftBlocks.count();
    expect(afterSecondCount).toBeGreaterThan(initialBlockCount);

    // When multiple waarneemgroepen are selected, row labels should appear
    // identifying which row belongs to which waarneemgroep
    const rowLabels = page.locator('[data-row-name]');
    const labelCount = await rowLabels.count();
    expect(labelCount).toBeGreaterThan(0);

    // Verify both waarneemgroep names appear as row identifiers in the calendar
    await expect(page.locator('[data-row-name="Test10"]').first()).toBeAttached();
    await expect(page.locator('[data-row-name="Test09"]').first()).toBeAttached();
  });

  test('unchecking a waarneemgroep removes its shifts from the calendar', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    // Check a second (test) waarneemgroep to have multiple
    const secondCheckbox = page.getByRole('checkbox', { name: /Test09/ });
    await secondCheckbox.check();
    await page.waitForTimeout(1000);
    const countWithTwo = await shiftBlocks.count();

    // Now uncheck the second waarneemgroep
    await secondCheckbox.uncheck();
    await page.waitForTimeout(1000);
    const countWithOne = await shiftBlocks.count();

    expect(countWithOne).toBeLessThan(countWithTwo);

    // Row labels for the unchecked waarneemgroep should be gone
    await expect(page.locator('[data-row-name="Test09"]')).toHaveCount(0);
  });

  test('month navigation works and loads new data', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    // Navigate to a different month
    await page.getByRole('button', { name: 'Volgende maand' }).click();

    // Calendar should still show structure
    await expect(page.getByText('Maandag')).toBeVisible();
    await expect(page.getByText(/^Week \d+$/).first()).toBeVisible();

    // Navigate back
    await page.getByRole('button', { name: 'Vorige maand' }).click();
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });
  });
});
