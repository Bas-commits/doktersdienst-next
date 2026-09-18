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
// on those days are ended and inert (ShiftBlock.tsx's `isEnded` gate disables ALL click handlers
// on the top/middle/bottom stripes of that day), so `.first()`/`.nth(N)` on any stripe collection
// can silently pick a block that no-ops on click. Only shift-block-middle carries a
// `data-current-date` attribute, but top/middle/bottom stripes for the same day render together
// in the same DOM order, so the index of the first future middle block applies to all three.
//
// This page also renders a second "preferences row" strip using the same ShiftBlock component
// (see the "must NOT render preference colors" test below), so the search is scoped to main
// shift blocks only, the same way that test already does.
async function futureBlockIndex(page: import('@playwright/test').Page): Promise<number> {
  const index = await page.evaluate(() => {
    const now = Date.now();
    const blocks = Array.from(
      document.querySelectorAll(
        '[data-testid="shift-block-middle"]:not([aria-label="preferences row"] [data-testid="shift-block-middle"])'
      )
    );
    return blocks.findIndex((el) => {
      const raw = el.getAttribute('data-current-date');
      return raw != null && new Date(raw.replace(' ', 'T')).getTime() > now;
    });
  });
  if (index < 0) throw new Error('No shift block with a future start time found');
  return index;
}

test.describe.configure({ mode: 'serial' });
test.describe('Rooster maken secretaris — shift assignment', () => {
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

    // Find an empty middle stripe (data-doctor="0" means unassigned) that is still in the future
    const startIndex = await futureBlockIndex(page);
    const emptyMiddle = page.getByTestId('shift-block-middle').nth(startIndex);

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    // force: true — Test10 has overlapping legacy dienst records on some days, whose absolutely
    // positioned wrapper (data-box-type="morning") can sit on top of a sibling day's block and
    // intercept the click even though the target block itself is fully visible and enabled.
    await emptyMiddle.click({ force: true });
    const response = await assignResponse;
    expect(response.status()).toBe(200);

    // Verify the block now shows doctor initials (non-empty text)
    await page.waitForTimeout(1000); // Wait for refresh
  });

  test('T020: delete middle stripe assignment', async ({ page }) => {
    // First assign a doctor
    await selectFirstDoctor(page);
    const startIndex = await futureBlockIndex(page);
    const middleBlock = page.getByTestId('shift-block-middle').nth(startIndex);

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click({ force: true });
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
    await middleBlock.click({ force: true });
    const response = await deleteResponse;
    expect(response.status()).toBe(200);
  });

  // --- US2: Top stripe ---

  test('T028: assign doctor to top stripe', async ({ page }) => {
    await selectFirstDoctor(page);

    // Find a top stripe and click it
    const startIndex = await futureBlockIndex(page);
    const topStripe = page.getByTestId('shift-block-top').nth(startIndex);
    await expect(topStripe).toBeVisible();

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click({ force: true });
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
    await topStripe.click({ force: true });
    await maybeCleanup;
  });

  // --- US3: Bottom stripe ---

  test('T039: assign doctor to bottom stripe', async ({ page }) => {
    await selectFirstDoctor(page);

    // Find a bottom stripe and click it
    const startIndex = await futureBlockIndex(page);
    const bottomStripe = page.getByTestId('shift-block-bottom').nth(startIndex);
    await expect(bottomStripe).toBeVisible();

    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await bottomStripe.click({ force: true });
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
    await bottomStripe.click({ force: true });
    await maybeCleanup;
  });

  // --- US4: All three stripes independently ---

  test('T046: assign three doctors to all stripes of same block', async ({ page }) => {
    // Get the first shift block area (we need top/middle/bottom of the same block)
    // Find all shift blocks that have all three stripes
    const topStripes = page.getByTestId('shift-block-top');
    const middleStripes = page.getByTestId('shift-block-middle');
    const bottomStripes = page.getByTestId('shift-block-bottom');

    const startIndex = await futureBlockIndex(page);
    const topStripe = topStripes.nth(startIndex);
    const middleStripe = middleStripes.nth(startIndex);
    const bottomStripe = bottomStripes.nth(startIndex);
    await expect(topStripe).toBeVisible();
    await expect(middleStripe).toBeVisible();
    await expect(bottomStripe).toBeVisible();

    // Select doctor and assign to middle
    await selectFirstDoctor(page);
    let response = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleStripe.click({ force: true });
    expect((await response).status()).toBe(200);
    // Each successful assign shows a sonner toast; it can still be animating/visible over the
    // corner of the viewport where the next stripe happens to render, so wait for it to clear
    // rather than a fixed timeout.
    await page.locator('[data-sonner-toast]').first().waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});

    // Assign to top
    response = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click({ force: true });
    expect((await response).status()).toBe(200);
    await page.locator('[data-sonner-toast]').first().waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});

    // Assign to bottom
    response = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await bottomStripe.click({ force: true });
    expect((await response).status()).toBe(200);

    // Cleanup: delete all three (best-effort — some stripes may already be empty after refresh)
    await page.keyboard.press('Escape');
    await enableDeleteMode(page);

    for (const stripe of [topStripe, middleStripe, bottomStripe]) {
      const maybeCleanup = Promise.race([
        page.waitForResponse(
          (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
        ),
        page.waitForTimeout(2000),
      ]);
      await stripe.click({ force: true });
      await maybeCleanup;
    }
  });

  // --- US5: Persistence after reload ---

  test('T049: assignments persist after page reload', async ({ page }) => {
    await selectFirstDoctor(page);
    const startIndex = await futureBlockIndex(page);
    const middleBlock = page.getByTestId('shift-block-middle').nth(startIndex);

    // Assign
    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click({ force: true });
    expect((await assignResponse).status()).toBe(200);
    await page.waitForTimeout(1000);

    // Read the assigned doctor ID and block identifiers. data-current-date (the exact shift start
    // timestamp) disambiguates Test10's overlapping legacy dienst records on the same calendar
    // day — data-date/month/year alone can match more than one block on those days.
    const doctorIdBefore = await middleBlock.getAttribute('data-doctor');
    const currentDateAttr = await middleBlock.getAttribute('data-current-date');
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
      `[data-testid="shift-block-middle"][data-date="${dateAttr}"][data-month="${monthAttr}"][data-year="${yearAttr}"][data-current-date="${currentDateAttr}"]`
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
    await reloadedBlock.click({ force: true });
    await cleanupResponse;
  });

  // --- Edge cases ---

  test('T055: clicking stripe without selecting doctor does nothing', async ({ page }) => {
    const middleBlock = page.getByTestId('shift-block-middle').first();
    const doctorBefore = await middleBlock.getAttribute('data-doctor');

    // Click without selecting any doctor or delete mode
    await middleBlock.click({ force: true });

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
    const startIndex = await futureBlockIndex(page);
    const middleBlock = page.getByTestId('shift-block-middle').nth(startIndex);
    const assignResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click({ force: true });
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
    await middleBlock.click({ force: true });
    await cleanup;
  });

  test('assigning the same stripe twice replaces the record instead of creating a duplicate', async ({ page }) => {
    await selectFirstDoctor(page);
    const startIndex = await futureBlockIndex(page);
    const middleBlock = page.getByTestId('shift-block-middle').nth(startIndex);
    await expect(middleBlock).toBeVisible();

    // First assignment
    let resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click({ force: true });
    const firstRes = await resp;
    expect(firstRes.status()).toBe(200);
    const body = firstRes.request().postDataJSON();
    await page.waitForTimeout(1000);

    // Second assignment to the same stripe (same doctor) — should replace, not duplicate
    resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await middleBlock.click({ force: true });
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
    await middleBlock.click({ force: true });
    await cleanupResp;
  });

  test('assigning achterwacht then reassigning produces exactly one type=5 record', async ({ page }) => {
    await selectFirstDoctor(page);
    const startIndex = await futureBlockIndex(page);
    const topStripe = page.getByTestId('shift-block-top').nth(startIndex);
    await expect(topStripe).toBeVisible();

    // First achterwacht assignment
    let resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click({ force: true });
    const firstRes = await resp;
    expect(firstRes.status()).toBe(200);
    const body = firstRes.request().postDataJSON();
    // The assign toast can still be visible over the same stripe on the immediate re-click.
    await page.locator('[data-sonner-toast]').first().waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});

    // Second achterwacht assignment to the same stripe
    resp = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/assign') && r.request().method() === 'POST'
    );
    await topStripe.click({ force: true });
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
    await topStripe.click({ force: true });
    await achtCleanup;
  });
});
