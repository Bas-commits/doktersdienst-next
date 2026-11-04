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
}

// The overnames page silently refuses to open the propose modal for a dienst in the past
// (see handleShiftClick in overnames.tsx). The visible month always includes a few padding
// days before "today", so `.first()` on assigned blocks can land on one of those — find a
// block whose start time is still in the future instead.
//
// data-current-date is NOT unique: a shift that crosses midnight renders as two adjacent day
// cells that both carry the shift's own start time. `.first()` resolves that the same way the
// evaluate() loop below already did (first in document order).
// Every run leaves proposals behind on Test10, and near the end of a month the few future days
// left in the current view fill up (on 28 sep only 28 sep - 4 okt was still ahead). Page forward
// instead of failing; callers that reload the page use showMonthOf() to come back.
const MAX_MONTHS_AHEAD = 3;

async function goToNextMonth(page: Page) {
  const monthLabel = page.getByRole('button', { name: 'Kies maand en jaar' });
  const before = await monthLabel.textContent();
  await page.getByRole('button', { name: 'Volgende maand' }).click();
  await expect(monthLabel).not.toHaveText(before ?? '');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('shift-block-middle').first()).toBeVisible({ timeout: 15_000 });
}

/** After a reload the page is back on today's month; page forward to the month of `currentDate`. */
async function showMonthOf(page: Page, currentDate: string) {
  const [year, month] = currentDate.split('-').map(Number);
  const now = new Date();
  const monthsAhead = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  for (let i = 0; i < monthsAhead; i++) await goToNextMonth(page);
}

async function futureAssignedBlockLocator(page: Page, requireNoOvername = false) {
  for (let monthsAhead = 0; ; monthsAhead++) {
    const currentDate = await findFutureShiftDate(page, requireNoOvername);
    if (currentDate) {
      return page
        .locator(
          `[data-testid="shift-block-middle"][data-doctor]:not([data-doctor="0"])[data-current-date="${currentDate}"]`
        )
        .first();
    }
    if (monthsAhead >= MAX_MONTHS_AHEAD) {
      throw new Error('No assigned shift block with a future start time found');
    }
    await goToNextMonth(page);
  }
}

async function findFutureShiftDate(page: Page, requireNoOvername: boolean): Promise<string | null> {
  return page.evaluate((skipOvernames) => {
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
    // ShiftBlock draws the (voorstel-)overname badge only on the LAST segment of a multi-day
    // shift. A shift that ends after the last day in the grid (e.g. Sunday 08:00 -> Monday 08:00
    // on the final row) never shows its badge in this month, so a test that proposes on it can't
    // find the pending overlay afterwards. Only pick shifts that end inside the visible grid.
    const pad = (n: number) => String(n).padStart(2, '0');
    const allSegments = Array.from(document.querySelectorAll('[data-testid="shift-block-middle"]'));
    const lastVisibleDay = allSegments
      .map((seg) => {
        const y = Number(seg.getAttribute('data-year'));
        const m = Number(seg.getAttribute('data-month'));
        const d = Number(seg.getAttribute('data-date'));
        return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
          ? `${y}-${pad(m + 1)}-${pad(d)}`
          : '';
      })
      .reduce((max, day) => (day > max ? day : max), '');
    for (const el of Array.from(blocks)) {
      const raw = el.getAttribute('data-current-date');
      if (!raw) continue;
      if (new Date(raw.replace(' ', 'T')).getTime() <= now) continue;
      const endDay = (el.getAttribute('data-next-date') ?? '').slice(0, 10);
      if (endDay && lastVisibleDay && endDay > lastVisibleDay) continue;
      // Skip a shift that already carries a pending/accepted overname from an earlier test run —
      // proposing against it again returns 409, and it may no longer be pending by the time we
      // look, which breaks a test that specifically verifies the accept flow end to end.
      if (skipOvernames && datesWithOvername.has(raw)) continue;
      return raw;
    }
    return null;
  }, requireNoOvername);
}

// OvernameModal's "Naar:" doctor field is a Base UI dropdown menu (@/components/ui/dropdown-menu),
// not a native <select>. Its content portals to document.body, outside any modal container, so
// items must be located from the page root rather than scoped to a modal wrapper.
async function selectTargetDoctor(page: Page) {
  const trigger = page.getByRole('button', { name: 'Selecteer een medewerker…' });
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

// login() alone can use up to 15s re-selecting Test10, and the dev server compiles /overnames on
// first visit. With the default 30s budget the last assertions of a test ran out of time while the
// modal they were waiting for was already on screen.
const OVERNAMES_TEST_TIMEOUT = 60_000;

test.describe('Overnames', () => {
  test.describe.configure({ timeout: OVERNAMES_TEST_TIMEOUT });

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
  test.describe.configure({ mode: 'serial', timeout: OVERNAMES_TEST_TIMEOUT });

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

    // Herladen zodat het pending overname-overlay blok op het rooster verschijnt. Na het herladen
    // staat de pagina weer op de huidige maand; de dienst kan een maand verder liggen.
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });
    await showMonthOf(page, originalCurrentDate ?? '');

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
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });
    await showMonthOf(page, originalCurrentDate ?? '');

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
  test.describe.configure({ mode: 'serial', timeout: OVERNAMES_TEST_TIMEOUT });

  test('secretaris sees pending proposals in the header popover', async ({ page }) => {
    await login(page);

    // First ensure at least one pending proposal exists by creating one
    const status = await createProposal(page);
    // 201 = created, 409 = already exists — both are fine
    expect(status === 201 || status === 409, `Proposal creation returned ${status}`).toBe(true);

    // Navigate to any page so the header reloads pending verzoeken. Listen before navigating,
    // or the pending call can finish before waitForResponse is registered.
    const pendingLoaded = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/pending') && resp.status() === 200,
      { timeout: 10_000 }
    );
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();
    await pendingLoaded;

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

  test('declining a proposal from the header marks it as declined', async ({ page }) => {
    await login(page);

    // Create a fresh proposal so there's always something to decline. 201 = created, 409 = one
    // already exists for that shift; either way there is a pending proposal.
    const status = await createProposal(page);
    expect(status === 201 || status === 409, `Proposal creation returned ${status}`).toBe(true);

    // Navigate to reload header. Listen before navigating, or the pending call can finish
    // before waitForResponse is registered.
    const pendingLoaded = page.waitForResponse(
      (resp) => resp.url().includes('/api/overnames/pending') && resp.status() === 200,
      { timeout: 10_000 }
    );
    await page.goto('/overnames');
    await expect(page.getByRole('heading', { name: 'Overnames' })).toBeVisible();
    await pendingLoaded;

    // Wait for the badge instead of checking once: a single isVisible() right after the fetch
    // could run before React rendered the count, and silently skipped the test.
    const overnameBtn = page.getByTestId('header-overname-btn');
    const badge = overnameBtn.locator('.rounded-full.bg-red-600');
    await expect(badge).toBeVisible({ timeout: 5_000 });

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
      // The badge count is NOT expected to drop: /api/overnames/pending deliberately keeps
      // declined proposals in a secretaris's list so a rejection isn't forgotten, until someone
      // deletes it. So check that this specific proposal is no longer pending instead.
      //
      // Match on the slot, not on overnameId: legacy rows carry no id, so the payload often
      // lacks it. Earlier runs leave declined rows for the same slot behind, so "a declined row
      // exists" proves nothing; propose refuses a second pending row per slot (409), which is
      // what makes "no pending row left" a sharp check.
      const sent = response.request().postDataJSON() as {
        van?: number;
        tot?: number;
        idwaarneemgroep?: number;
        iddeelnovern?: number;
      };
      expect(sent.van, 'respond payload carries the slot').toBeGreaterThan(0);
      await expect
        .poll(async () => {
          const pending = await page.request.get('/api/overnames/pending');
          const { verzoeken } = (await pending.json()) as {
            verzoeken: {
              overnameVanUnix: number;
              overnameTotUnix: number;
              idwaarneemgroep: number | null;
              iddeelnovern: number | null;
              status: string | null;
            }[];
          };
          return verzoeken.filter(
            (v) =>
              v.status === 'pending' &&
              v.overnameVanUnix === sent.van &&
              v.overnameTotUnix === sent.tot &&
              v.idwaarneemgroep === sent.idwaarneemgroep &&
              v.iddeelnovern === sent.iddeelnovern
          ).length;
        }, { timeout: 10_000 })
        .toBe(0);
    }
  });
});
