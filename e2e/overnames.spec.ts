import { test, expect, type Page } from '@playwright/test';

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

// Shared helpers
async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(secretarisEmail!);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(secretarisPassword!);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/rooster-inzien');
  // Selecting fires the header's own router.reload(); wait for it to settle before navigating
  // away ourselves, otherwise the two navigations race and the group pick can get lost.
  await page.getByTestId('header-group-select').selectOption(TEST_WAARNEEMGROEP_ID);
  await page.waitForLoadState('networkidle');
}

// The overnames page silently refuses to open the propose modal for a dienst in the past
// (see handleShiftClick in overnames.tsx). The visible month always includes a few padding
// days before "today", so `.first()` on assigned blocks can land on one of those — find a
// block whose start time is still in the future instead.
//
// data-current-date is NOT unique: a shift that crosses midnight renders as two adjacent day
// cells that both carry the shift's own start time. `.first()` resolves that the same way the
// evaluate() loop below already did (first in document order).
async function futureAssignedBlockLocator(page: Page, requireNoOvername = false) {
  const currentDate = await page.evaluate((skipOvernames) => {
    const now = Date.now();
    const blocks = document.querySelectorAll(
      '[data-testid="shift-block-middle"][data-doctor]:not([data-doctor="0"])'
    );
    // useDienstenSchedule renders a proposed/accepted overname as a SEPARATE overlay block
    // (its own shift-block-middle) sharing the same data-current-date as the original assignment,
    // rather than merging the badge into the original block. So "does this slot already have an
    // overname" has to be checked against every block sharing that timestamp, not just `el` itself.
    const datesWithOvername = new Set(
      Array.from(
        document.querySelectorAll(
          '[data-testid="voorstel-overname-badge"], [data-testid="overname-badge"]'
        )
      )
        .map((badge) => badge.closest('[data-testid="shift-block-middle"]')?.getAttribute('data-current-date'))
        .filter((d): d is string => !!d)
    );
    for (const el of Array.from(blocks)) {
      const raw = el.getAttribute('data-current-date');
      if (!raw) continue;
      if (new Date(raw.replace(' ', 'T')).getTime() <= now) continue;
      // Skip a shift that already carries a pending/accepted overname from an earlier test run —
      // proposing against it again returns 409, and it may no longer be pending by the time we
      // look, which breaks a test that specifically verifies the accept flow end to end.
      if (skipOvernames && datesWithOvername.has(raw)) continue;
      return raw;
    }
    return null;
  }, requireNoOvername);
  if (!currentDate) throw new Error('No assigned shift block with a future start time found');
  return page
    .locator(
      `[data-testid="shift-block-middle"][data-doctor]:not([data-doctor="0"])[data-current-date="${currentDate}"]`
    )
    .first();
}

// OvernameModal's "Naar:" doctor field is a Base UI dropdown menu (@/components/ui/dropdown-menu),
// not a native <select>. Its content portals to document.body, outside any modal container, so
// items must be located from the page root rather than scoped to a modal wrapper.
async function selectTargetDoctor(page: Page) {
  const trigger = page.getByRole('button', { name: 'Selecteer een arts…' });
  await expect(trigger).toBeVisible({ timeout: 5_000 });
  await trigger.click();

  const items = page.locator('[data-slot="dropdown-menu-item"]');
  await expect(items.first()).toBeVisible({ timeout: 5_000 });
  await items.first().click();
}

async function createProposal(page: Page): Promise<number | null> {
  await page.goto('/overnames');
  await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();

  const shiftBlocks = page.getByTestId('shift-block-middle');
  await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

  // Skip a shift the accept-flow test already proposed/accepted against — that block never
  // reverts (accepting only flips the proposal row, the original assignment is untouched), so
  // reusing "the first future block" unconditionally would collide with it forever.
  const assignedBlock = await futureAssignedBlockLocator(page, /* requireNoOvername */ true);
  await expect(assignedBlock).toBeVisible({ timeout: 10_000 });
  await assignedBlock.dispatchEvent('click');

  const modal = page.getByText('Overname voorstel');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await selectTargetDoctor(page);

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

    const assignedBlock = await futureAssignedBlockLocator(page);
    await expect(assignedBlock).toBeVisible({ timeout: 10_000 });
    await assignedBlock.dispatchEvent('click');

    const modal = page.getByText('Overname voorstel');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Naar:')).toBeVisible();

    await selectTargetDoctor(page);

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

    await expect(page.getByText('In afwachting')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('overname-accept')).toBeVisible();
    await expect(page.getByTestId('overname-decline')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sluiten' })).toBeVisible();

    await page.getByRole('button', { name: 'Sluiten' }).click();
    await expect(page.getByTestId('overname-accept')).not.toBeVisible();
  });
});

test.describe('Accepteren van een overname voorstel', () => {
  test.describe.configure({ mode: 'serial' });

  test('accepting a proposal reassigns the dienst to the target doctor', async ({ page }) => {
    await login(page);
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();

    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

    const assignedBlock = await futureAssignedBlockLocator(page, /* requireNoOvername */ true);
    await expect(assignedBlock).toBeVisible({ timeout: 10_000 });
    // Identificeert straks hetzelfde tijdvak terug, ongeacht welke andere overnames er al
    // in de data staan.
    const originalCurrentDate = await assignedBlock.getAttribute('data-current-date');
    const originalDoctorId = await assignedBlock.getAttribute('data-doctor');
    await assignedBlock.dispatchEvent('click');

    const proposeModal = page.getByText('Overname voorstel');
    await expect(proposeModal).toBeVisible({ timeout: 5_000 });

    await selectTargetDoctor(page);

    const proposeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/propose') && resp.request().method() === 'POST'
    );
    const proposeRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/overnames/propose') && req.method() === 'POST'
    );
    await page.getByRole('button', { name: 'Voorstel indienen' }).click();
    const [proposeResponse, proposeRequest] = await Promise.all([
      proposeResponsePromise,
      proposeRequestPromise,
    ]);
    expect([201, 409]).toContain(proposeResponse.status());
    const targetDoctorId = String(proposeRequest.postDataJSON().iddeelnovern);

    // Herladen zodat het pending overname-overlay blok op het rooster verschijnt.
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

    // useDienstenSchedule renders a proposed overname as a SEPARATE overlay block (its own
    // shift-block-middle entry, pushed alongside the original assignment — see
    // dienstenToShiftBlocks in useDienstenSchedule.ts), not merged into the original block. Both
    // end up with the same data-doctor (the original doctor) and data-current-date, so `.first()`
    // can land on either one — only the overlay carries the voorstel-overname-badge.
    const pendingBlock = page
      .locator(
        `[data-testid="shift-block-middle"][data-doctor="${originalDoctorId}"][data-current-date="${originalCurrentDate}"]`
      )
      .filter({ has: page.getByTestId('voorstel-overname-badge') });
    await expect(pendingBlock).toBeVisible({ timeout: 10_000 });
    await pendingBlock.dispatchEvent('click');

    await expect(page.getByText('In afwachting')).toBeVisible({ timeout: 5_000 });

    const respondPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/respond') && resp.request().method() === 'POST'
    );
    await page.getByTestId('overname-accept').click();
    const respondResponse = await respondPromise;
    expect([200, 404]).toContain(respondResponse.status());
    test.skip(respondResponse.status() === 404, 'Voorstel al afgehandeld door een parallelle testrun');

    await expect(page.getByText('In afwachting')).not.toBeVisible({ timeout: 5_000 });

    // Herladen en verifiëren dat exact dezelfde dienst nu geaccepteerd bij de andere arts staat.
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();

    // Same dual-block situation as the pending overlay above: the original (never-updated)
    // assignment row and the now-accepted overname row can render two separate blocks. Only the
    // accepted overlay carries data-doctor == targetDoctorId AND the overname-badge together, but
    // filter on the badge explicitly rather than relying on data-doctor alone to disambiguate.
    const acceptedBlock = page
      .locator(
        `[data-testid="shift-block-middle"][data-doctor="${targetDoctorId}"][data-current-date="${originalCurrentDate}"]`
      )
      .filter({ has: page.getByTestId('overname-badge') });
    await expect(acceptedBlock).toBeVisible({ timeout: 10_000 });

    await acceptedBlock.dispatchEvent('click');
    await expect(page.getByText('Geaccepteerd')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Sluiten' }).click();
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
    await expect(popover.getByText('Van:', { exact: true })).toBeVisible();
    await expect(popover.getByText('Naar:', { exact: true })).toBeVisible();

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
