import { test, expect } from '@playwright/test';

test.describe('Overnames', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail' }).fill('bartveltggdhvb@sivision.nl');
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('bassophie2016');
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/rooster-inzien');
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();
  });

  test('clicking an assigned shift opens the overname modal and submitting creates a proposal', async ({ page }) => {
    // Wait for shift blocks to load
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

    // Find an assigned shift block (one with a doctor, i.e. has a background color, not an empty slot)
    // Assigned blocks have a data-doctor attribute > 0
    const assignedBlock = page.locator('[data-testid="shift-block-middle"][data-doctor]:not([data-doctor="0"])').first();
    await expect(assignedBlock).toBeVisible({ timeout: 10_000 });

    // Click the assigned block to open the overname modal.
    // Use dispatchEvent because absolutely positioned shift blocks may overlap
    // and intercept pointer events from Playwright's native click.
    await assignedBlock.dispatchEvent('click');

    // The overname modal should appear
    const modal = page.getByText('Overname voorstel');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // The modal should show shift details
    await expect(page.getByText('Arts:')).toBeVisible();

    // Doctor dropdown should be present (inside the modal)
    const modalContainer = page.locator('.fixed.inset-0');
    const doctorSelect = modalContainer.locator('select');
    await expect(doctorSelect).toBeVisible();

    // Wait for doctors to load in the dropdown (more than just the placeholder option)
    await expect(async () => {
      const optionCount = await doctorSelect.locator('option').count();
      expect(optionCount).toBeGreaterThan(1);
    }).toPass({ timeout: 5_000 });

    // Select the second doctor (first is the placeholder)
    const secondOption = doctorSelect.locator('option').nth(1);
    const doctorValue = await secondOption.getAttribute('value');
    await doctorSelect.selectOption(doctorValue!);

    // Intercept the propose API call to verify it succeeds
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/propose') && resp.request().method() === 'POST'
    );

    // Click the submit button
    await page.getByRole('button', { name: 'Voorstel indienen' }).click();

    // Wait for the API response
    const response = await responsePromise;
    const body = await response.json();

    // The proposal must be created (201) or already exist (409 from a prior run).
    // Both prove the type=0 resolution works — the old bug returned 400/500.
    const status = response.status();
    expect(
      status === 201 || status === 409,
      `Expected 201 or 409 but got ${status}: ${JSON.stringify(body)}`
    ).toBe(true);
  });
});
