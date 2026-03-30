import { test, expect, type Page } from '@playwright/test';

// Shared helpers
async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('bartveltggdhvb@sivision.nl');
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('bassophie2016');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/rooster-inzien');
}

async function createProposal(page: Page): Promise<number | null> {
  await page.goto('/overnames');
  await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();

  const shiftBlocks = page.getByTestId('shift-block-middle');
  await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

  const assignedBlock = page.locator(
    '[data-testid="shift-block-middle"][data-doctor]:not([data-doctor="0"])'
  ).first();
  await expect(assignedBlock).toBeVisible({ timeout: 10_000 });
  await assignedBlock.dispatchEvent('click');

  const modal = page.getByText('Overname voorstel');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const modalContainer = page.locator('.fixed.inset-0');
  const doctorSelect = modalContainer.locator('select');
  await expect(doctorSelect).toBeVisible();

  await expect(async () => {
    const optionCount = await doctorSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);
  }).toPass({ timeout: 5_000 });

  const secondOption = doctorSelect.locator('option').nth(1);
  const doctorValue = await secondOption.getAttribute('value');
  await doctorSelect.selectOption(doctorValue!);

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/overnames/propose') && resp.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Voorstel indienen' }).click();

  const response = await responsePromise;
  const status = response.status();
  return status === 201 ? 201 : status;
}

test.describe('Overnames', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();
  });

  test('clicking an assigned shift opens the overname modal and submitting creates a proposal', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

    const assignedBlock = page.locator(
      '[data-testid="shift-block-middle"][data-doctor]:not([data-doctor="0"])'
    ).first();
    await expect(assignedBlock).toBeVisible({ timeout: 10_000 });
    await assignedBlock.dispatchEvent('click');

    const modal = page.getByText('Overname voorstel');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Arts:')).toBeVisible();

    const modalContainer = page.locator('.fixed.inset-0');
    const doctorSelect = modalContainer.locator('select');
    await expect(doctorSelect).toBeVisible();

    await expect(async () => {
      const optionCount = await doctorSelect.locator('option').count();
      expect(optionCount).toBeGreaterThan(1);
    }).toPass({ timeout: 5_000 });

    const secondOption = doctorSelect.locator('option').nth(1);
    const doctorValue = await secondOption.getAttribute('value');
    await doctorSelect.selectOption(doctorValue!);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/propose') && resp.request().method() === 'POST'
    );

    await page.getByRole('button', { name: 'Voorstel indienen' }).click();

    const response = await responsePromise;
    const body = await response.json();
    const status = response.status();
    expect(
      status === 201 || status === 409,
      `Expected 201 or 409 but got ${status}: ${JSON.stringify(body)}`
    ).toBe(true);
  });

  test('clicking an overname overlay block opens the detail modal', async ({ page }) => {
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

    const overnameBadge = page.getByTestId('voorstel-overname-badge').first();
    const hasOvername = await overnameBadge.isVisible().catch(() => false);
    if (!hasOvername) {
      test.skip();
      return;
    }

    const parentBlock = overnameBadge.locator('xpath=ancestor::div[@data-testid="shift-block-middle"]');
    await parentBlock.dispatchEvent('click');

    await expect(page.getByText('Overname details')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('In afwachting')).toBeVisible();
    await expect(page.getByText('Van arts (origineel)')).toBeVisible();
    await expect(page.getByText('Naar arts (overname)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sluiten' })).toBeVisible();

    await page.getByRole('button', { name: 'Sluiten' }).click();
    await expect(page.getByText('Overname details')).not.toBeVisible();
  });
});

test.describe('Header overname verzoeken', () => {
  test.describe.configure({ mode: 'serial' });

  test('secretaris sees pending proposals in the header popover', async ({ page }) => {
    await login(page);

    // First ensure at least one pending proposal exists by creating one
    const status = await createProposal(page);
    // 201 = created, 409 = already exists — both are fine
    expect(status === 201 || status === 409, `Proposal creation returned ${status}`).toBe(true);

    // Navigate to any page so the header reloads pending verzoeken
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();

    // Wait for the pending API call to complete
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/pending') && resp.status() === 200,
      { timeout: 10_000 }
    );

    // The overname button in the header should have a badge
    const overnameBtn = page.getByTestId('header-overname-btn');
    await expect(overnameBtn).toBeVisible();

    // Badge should show count > 0
    const badge = overnameBtn.locator('.rounded-full.bg-red-600');
    await expect(badge).toBeVisible({ timeout: 5_000 });
    const badgeText = await badge.textContent();
    expect(Number(badgeText)).toBeGreaterThan(0);

    // Click to open popover
    await overnameBtn.click();
    const popover = page.getByTestId('overname-popover');
    await expect(popover).toBeVisible({ timeout: 5_000 });

    // Popover should show verzoek details
    await expect(popover.getByText('verzoeken')).toBeVisible();
    await expect(popover.getByText('van', { exact: true })).toBeVisible();
    await expect(popover.getByText('naar', { exact: true })).toBeVisible();

    // Accept and decline buttons should be visible
    await expect(page.getByTestId('overname-accept')).toBeVisible();
    await expect(page.getByTestId('overname-decline')).toBeVisible();
  });

  test('declining a proposal removes it from the header', async ({ page }) => {
    await login(page);

    // Create a fresh proposal so there's always something to decline
    await createProposal(page);

    // Navigate to reload header
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();

    // Wait for pending to load
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/pending') && resp.status() === 200,
      { timeout: 10_000 }
    );

    const overnameBtn = page.getByTestId('header-overname-btn');
    const badge = overnameBtn.locator('.rounded-full.bg-red-600');
    const hasBadge = await badge.isVisible().catch(() => false);
    if (!hasBadge) {
      test.skip();
      return;
    }

    const initialCount = Number(await badge.textContent());

    // Open popover and decline
    await overnameBtn.click();
    const popover = page.getByTestId('overname-popover');
    await expect(popover).toBeVisible();

    // Intercept the respond call
    const respondPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/respond') && resp.request().method() === 'POST'
    );

    await page.getByTestId('overname-decline').click();

    const response = await respondPromise;
    // 200 = declined, 404 = already handled by a parallel worker
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      // Wait for re-fetch of pending
      await page.waitForResponse(
        (resp) => resp.url().includes('/api/overnames/pending') && resp.status() === 200,
        { timeout: 5_000 }
      );

      // Badge count should have decreased or disappeared
      await page.waitForTimeout(500);
      const badgeStillVisible = await badge.isVisible().catch(() => false);
      if (badgeStillVisible) {
        const newCount = Number(await badge.textContent());
        expect(newCount).toBeLessThan(initialCount);
      }
    }
  });
});
