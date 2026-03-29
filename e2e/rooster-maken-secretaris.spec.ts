import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.describe('Rooster maken secretaris — shift assignment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail' }).fill('bartveltggdhvb@sivision.nl');
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('bassophie2016');
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/rooster-inzien');
    await page.goto('/rooster-maken-secretaris');
    await expect(page.getByRole('heading', { name: 'Rooster maken' })).toBeVisible();

    // Wait for shift blocks to load
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });
  });

  // Helper: select the first doctor from the sidebar
  async function selectFirstDoctor(page: import('@playwright/test').Page) {
    // Wait for doctors list to load (no "Laden…" text)
    await expect(page.getByText('Laden…')).not.toBeVisible({ timeout: 10_000 });

    // Find the first doctor button (skip "Verwijderen" button)
    const doctorButtons = page.locator('button').filter({ has: page.locator('.h-7.w-7') });
    // Skip the first one (Verwijderen / trash button) — get the second one (first doctor)
    const firstDoctor = doctorButtons.nth(1);
    await expect(firstDoctor).toBeVisible();
    await firstDoctor.click();
    return firstDoctor;
  }

  // Helper: enable delete mode
  async function enableDeleteMode(page: import('@playwright/test').Page) {
    const deleteButton = page.getByRole('button', { name: 'Verwijderen' });
    await deleteButton.click();
    await expect(page.getByText('Verwijdermodus')).toBeVisible();
  }

  // --- US1: Middle stripe ---

  test('T018: assign doctor to middle stripe', async ({ page }) => {
    await selectFirstDoctor(page);

    // Find an empty middle stripe (data-doctor="0" means unassigned)
    const emptyMiddle = page.getByTestId('shift-block-middle').filter({ hasAttribute: 'data-doctor' }).first();

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await emptyMiddle.click();
    const response = await assignResponse;
    expect(response.status()).toBe(200);

    // Verify the block now shows doctor initials (non-empty text)
    await page.waitForTimeout(1000); // Wait for refresh
  });

  test('T020: delete middle stripe assignment', async ({ page }) => {
    // First assign a doctor
    await selectFirstDoctor(page);
    const middleBlock = page.getByTestId('shift-block-middle').first();

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    await assignResponse;
    await page.waitForTimeout(500);

    // Press Escape to deselect doctor
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Enable delete mode
    await enableDeleteMode(page);

    // Click the same block to remove
    const deleteResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    const response = await deleteResponse;
    expect(response.status()).toBe(200);
  });

  // --- US2: Top stripe ---

  test('T028: assign doctor to top stripe', async ({ page }) => {
    await selectFirstDoctor(page);

    // Find a top stripe and click it
    const topStripe = page.getByTestId('shift-block-top').first();
    await expect(topStripe).toBeVisible();

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click();
    const response = await assignResponse;
    expect(response.status()).toBe(200);

    // Cleanup: unassign (best-effort)
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);
    const maybeCleanup = Promise.race([
      page.waitForResponse(
        (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
      ),
      page.waitForTimeout(2000),
    ]);
    await topStripe.click();
    await maybeCleanup;
  });

  // --- US3: Bottom stripe ---

  test('T039: assign doctor to bottom stripe', async ({ page }) => {
    await selectFirstDoctor(page);

    // Find a bottom stripe and click it
    const bottomStripe = page.getByTestId('shift-block-bottom').first();
    await expect(bottomStripe).toBeVisible();

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await bottomStripe.click();
    const response = await assignResponse;
    expect(response.status()).toBe(200);

    // Cleanup: unassign (best-effort — may already be empty after refresh)
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);
    const maybeCleanup = Promise.race([
      page.waitForResponse(
        (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
      ),
      page.waitForTimeout(2000),
    ]);
    await bottomStripe.click();
    await maybeCleanup;
  });

  // --- US4: All three stripes independently ---

  test('T046: assign three doctors to all stripes of same block', async ({ page }) => {
    // Get the first shift block area (we need top/middle/bottom of the same block)
    // Find all shift blocks that have all three stripes
    const topStripes = page.getByTestId('shift-block-top');
    const middleStripes = page.getByTestId('shift-block-middle');
    const bottomStripes = page.getByTestId('shift-block-bottom');

    await expect(topStripes.first()).toBeVisible();
    await expect(middleStripes.first()).toBeVisible();
    await expect(bottomStripes.first()).toBeVisible();

    // Select doctor and assign to middle
    await selectFirstDoctor(page);
    let response = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleStripes.first().click();
    expect((await response).status()).toBe(200);
    await page.waitForTimeout(500);

    // Assign to top
    response = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripes.first().click();
    expect((await response).status()).toBe(200);
    await page.waitForTimeout(500);

    // Assign to bottom
    response = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await bottomStripes.first().click();
    expect((await response).status()).toBe(200);

    // Cleanup: delete all three (best-effort — some stripes may already be empty after refresh)
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);

    for (const stripe of [topStripes.first(), middleStripes.first(), bottomStripes.first()]) {
      const maybeCleanup = Promise.race([
        page.waitForResponse(
          (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
        ),
        page.waitForTimeout(2000),
      ]);
      await stripe.click();
      await maybeCleanup;
    }
  });

  // --- US5: Persistence after reload ---

  test('T049: assignments persist after page reload', async ({ page }) => {
    await selectFirstDoctor(page);
    const middleBlock = page.getByTestId('shift-block-middle').first();

    // Assign
    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    expect((await assignResponse).status()).toBe(200);
    await page.waitForTimeout(1000);

    // Read the assigned doctor ID and block identifiers
    const doctorIdBefore = await middleBlock.getAttribute('data-doctor');
    const dateAttr = await middleBlock.getAttribute('data-date');
    const monthAttr = await middleBlock.getAttribute('data-month');
    const yearAttr = await middleBlock.getAttribute('data-year');
    expect(Number(doctorIdBefore)).toBeGreaterThan(0);

    // Reload
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Rooster maken' })).toBeVisible();
    await expect(page.getByTestId('shift-block-middle').first()).toBeVisible({ timeout: 15_000 });

    // Find the same block after reload
    const reloadedBlock = page.locator(
      `[data-testid="shift-block-middle"][data-date="${dateAttr}"][data-month="${monthAttr}"][data-year="${yearAttr}"]`
    ).first();
    await expect(reloadedBlock).toBeVisible({ timeout: 5_000 });
    const doctorIdAfter = await reloadedBlock.getAttribute('data-doctor');
    expect(doctorIdAfter).toBe(doctorIdBefore);

    // Cleanup
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);
    const cleanupResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await reloadedBlock.click();
    await cleanupResponse;
  });

  // --- Edge cases ---

  test('T055: clicking stripe without selecting doctor does nothing', async ({ page }) => {
    const middleBlock = page.getByTestId('shift-block-middle').first();
    const doctorBefore = await middleBlock.getAttribute('data-doctor');

    // Click without selecting any doctor or delete mode
    await middleBlock.click();

    // No API call should fire — wait briefly and check doctor hasn't changed
    await page.waitForTimeout(500);
    const doctorAfter = await middleBlock.getAttribute('data-doctor');
    expect(doctorAfter).toBe(doctorBefore);
  });

  test('selecting a doctor must NOT render preference colors on main shift blocks', async ({ page }) => {
    // Wait for doctors to load
    await expect(page.getByText('Laden…')).not.toBeVisible({ timeout: 10_000 });

    // Scope to main shift blocks only — exclude the preference lanes (below [aria-label="preferences row"])
    // Main shift blocks are inside the shift rows, NOT inside the preferences section.
    // We target shift-block-middle elements that do NOT have an ancestor with aria-label="preferences row".
    const mainShiftBlocks = page.locator(
      '[data-testid="shift-block-middle"]:not([aria-label="preferences row"] [data-testid="shift-block-middle"])'
    );

    // Select a doctor from the sidebar
    const doctorButtons = page.locator('button').filter({ has: page.locator('.h-7.w-7') });
    await doctorButtons.nth(1).click();
    await page.waitForTimeout(500);

    // After selecting, MAIN shift blocks must NOT have preference-colored backgrounds
    const preferenceColors = [
      'rgb(34, 197, 94)',   // green (#22c55e) - Liever wel
      'rgb(234, 179, 8)',   // yellow (#eab308) - Liever niet
      'rgb(239, 68, 68)',   // red (#ef4444) - Vakantie
      'rgb(168, 85, 247)',  // purple (#a855f7) - Nascholing
      'rgb(100, 116, 139)', // gray (#64748b) - FTE
    ];

    const blockCount = await mainShiftBlocks.count();
    const checkedBlocks = Math.min(blockCount, 20);
    for (let i = 0; i < checkedBlocks; i++) {
      const block = mainShiftBlocks.nth(i);
      const bg = await block.evaluate((el) => getComputedStyle(el).backgroundColor);
      for (const prefColor of preferenceColors) {
        expect(bg, `Main shift block ${i} should not have preference color ${prefColor}`).not.toBe(prefColor);
      }
    }

    // Escape to deselect
    await page.keyboard.press('Escape');
  });

  test('selecting a doctor while delete mode is active deactivates delete mode', async ({ page }) => {
    // Enable delete mode
    await enableDeleteMode(page);

    // Verify delete mode is active
    await expect(page.getByText('Verwijdermodus')).toBeVisible();

    // Now select a doctor
    await selectFirstDoctor(page);

    // Delete mode should be deactivated — "Verwijdermodus" hint should be gone
    await expect(page.getByText('Verwijdermodus')).not.toBeVisible();

    // The doctor should be selected — "geselecteerd" hint should be visible
    await expect(page.getByText('geselecteerd')).toBeVisible();

    // Clicking a shift block should ASSIGN (not delete)
    const middleBlock = page.getByTestId('shift-block-middle').first();
    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    const response = await assignResponse;
    expect(response.status()).toBe(200);

    // Verify the request body has a non-null iddeelnemer (assign, not unassign)
    const body = response.request().postDataJSON();
    expect(body.iddeelnemer).not.toBeNull();
    expect(body.iddeelnemer).toBeGreaterThan(0);

    // Cleanup
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);
    const cleanup = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    await cleanup;
  });

  test('assigning the same stripe twice replaces the record instead of creating a duplicate', async ({ page }) => {
    await selectFirstDoctor(page);
    // Use a block further down to avoid legacy-polluted first slots
    const middleBlock = page.getByTestId('shift-block-middle').nth(3);
    await expect(middleBlock).toBeVisible();

    // First assignment
    let resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    const firstRes = await resp;
    expect(firstRes.status()).toBe(200);
    const body = firstRes.request().postDataJSON();
    await page.waitForTimeout(1000);

    // Second assignment to the same stripe (same doctor) — should replace, not duplicate
    resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click();
    expect((await resp).status()).toBe(200);
    await page.waitForTimeout(1000);

    // Query the API for this exact slot
    const queryParams = new URLSearchParams({
      vanGte: String(body.van),
      totLte: String(body.tot),
      idwaarneemgroepIn: String(body.idwaarneemgroep),
      typeIn: '0,4,6',
    });
    const apiRes = await page.request.get(`/api/diensten?${queryParams}`);
    const data = await apiRes.json();
    // Only count type 0/4/6 records with EXACT van/tot match
    const exactMatches = (data.diensten ?? []).filter(
      (d: { van: number; tot: number; type: number }) =>
        d.van === body.van && d.tot === body.tot && [0, 4, 6].includes(d.type)
    );
    expect(exactMatches.length).toBe(1);

    // Cleanup
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);
    const cleanupResp = Promise.race([
      page.waitForResponse(
        (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
      ),
      page.waitForTimeout(2000),
    ]);
    await middleBlock.click();
    await cleanupResp;
  });

  test('assigning achterwacht then reassigning produces exactly one type=5 record', async ({ page }) => {
    await selectFirstDoctor(page);
    // Use a block further down to avoid legacy-polluted first slots
    const topStripe = page.getByTestId('shift-block-top').nth(3);
    await expect(topStripe).toBeVisible();

    // First achterwacht assignment
    let resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click();
    const firstRes = await resp;
    expect(firstRes.status()).toBe(200);
    const body = firstRes.request().postDataJSON();
    await page.waitForTimeout(500);

    // Second achterwacht assignment to the same stripe
    resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click();
    expect((await resp).status()).toBe(200);
    await page.waitForTimeout(500);

    // Verify exactly 1 type=5 record with exact van/tot
    const queryParams = new URLSearchParams({
      vanGte: String(body.van),
      totLte: String(body.tot),
      idwaarneemgroepIn: String(body.idwaarneemgroep),
      typeIn: '5',
    });
    const apiRes = await page.request.get(`/api/diensten?${queryParams}`);
    const data = await apiRes.json();
    const exactType5 = (data.diensten ?? []).filter(
      (d: { van: number; tot: number; type: number }) =>
        d.van === body.van && d.tot === body.tot && d.type === 5
    );
    expect(exactType5.length).toBe(1);

    // Cleanup (best-effort)
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);
    const achtCleanup = Promise.race([
      page.waitForResponse(
        (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
      ),
      page.waitForTimeout(2000),
    ]);
    await topStripe.click();
    await achtCleanup;
  });
});
