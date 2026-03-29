import { test, expect } from '@playwright/test';

test.describe('Rooster inzien', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail' }).fill('bartveltggdhvb@sivision.nl');
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('bassophie2016');
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/rooster-inzien');
    await expect(page.getByRole('heading', { name: /Welkom/ })).toBeVisible();
  });

  test('calendar is displayed with shift blocks after login', async ({ page }) => {
    // The first waarneemgroep checkbox should be checked by default
    const firstCheckbox = page.getByRole('checkbox', { name: /GGD HvB Den Bosch/ });
    await expect(firstCheckbox).toBeChecked();

    // Calendar day headers should be visible
    for (const day of ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']) {
      await expect(page.getByText(day)).toBeVisible();
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

    // The first waarneemgroep should be checked, others unchecked
    const firstCheckbox = page.getByRole('checkbox', { name: /GGD HvB Den Bosch/ });
    await expect(firstCheckbox).toBeChecked();

    // Pick a second waarneemgroep and check it
    const secondCheckbox = page.getByRole('checkbox', { name: /Forensisch artsen Brabant Oost/ });
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
    await expect(page.locator('[data-row-name="9 GGD HvB Den Bosch"]').first()).toBeAttached();
    await expect(page.locator('[data-row-name="45 Forensisch artsen Brabant Oost"]').first()).toBeAttached();
  });

  test('unchecking a waarneemgroep removes its shifts from the calendar', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 10_000 });

    // Check a second waarneemgroep to have multiple
    const secondCheckbox = page.getByRole('checkbox', { name: /Forensisch artsen Brabant Oost/ });
    await secondCheckbox.check();
    await page.waitForTimeout(1000);
    const countWithTwo = await shiftBlocks.count();

    // Now uncheck the second waarneemgroep
    await secondCheckbox.uncheck();
    await page.waitForTimeout(1000);
    const countWithOne = await shiftBlocks.count();

    expect(countWithOne).toBeLessThan(countWithTwo);

    // Row labels for the unchecked waarneemgroep should be gone
    await expect(page.locator('[data-row-name="45 Forensisch artsen Brabant Oost"]')).toHaveCount(0);
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
