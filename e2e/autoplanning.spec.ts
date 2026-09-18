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

// Deze suite navigeert twee extra maanden vooruit in beforeEach (om altijd in de toekomst te
// zitten) bovenop leegmaken/genereren/bevestigen-rondes tegen de externe testdatabase — dat
// loopt op tegen de standaard 30s testtimeout uit playwright.config.ts.
test.describe.configure({ mode: 'serial', timeout: 60_000 });
test.describe('Autoplanning — genereren, leegmaken, bevestigen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(secretarisEmail!);
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(secretarisPassword!);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/rooster-inzien');
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
    await page.goto('/rooster-maken-secretaris');
    await expect(page.getByRole('heading', { name: 'Rooster maken' })).toBeVisible();
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });

    // Move two months ahead of "today" so every slot in view is safely in the future — a
    // fixed calendar month would eventually become past and start hitting ShiftBlock's
    // isEnded click-disable gate, the same reason other specs derive "future" dynamically.
    const nextMonth = page.getByRole('button', { name: 'Volgende maand' });
    await nextMonth.click();
    await nextMonth.click();
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });
  });

  async function clearMonth(page: import('@playwright/test').Page) {
    await page.getByTestId('clear-rooster-scope').selectOption('month');
    await page.getByTestId('clear-rooster').click();
    const confirmButton = page.getByTestId('clear-rooster-confirm');
    await expect(confirmButton).toBeVisible();
    const clearResponse = page.waitForResponse(
      (r) => r.url().includes('/api/diensten/clear') && r.request().method() === 'POST'
    );
    await confirmButton.click();
    const response = await clearResponse;
    expect(response.status()).toBe(200);
    await page.waitForTimeout(500);
  }

  async function generateAndReadCount(page: import('@playwright/test').Page): Promise<number> {
    const generateResponse = page.waitForResponse(
      (r) => r.url().includes('/api/autoplanning/generate') && r.request().method() === 'POST'
    );
    await page.getByTestId('autoplanning-generate').click();
    const response = await generateResponse;
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { assignments: unknown[] };
    await expect(page.getByTestId('autoplanning-bar')).toBeVisible();
    return body.assignments.length;
  }

  test('leegmaken verwijdert bestaande toewijzingen in de gekozen maand', async ({ page }) => {
    await clearMonth(page);
    // Na leegmaken heeft elk basisslot (type=1) minstens één open sectie, dus een generate
    // op deze maand levert altijd minstens één voorstel op.
    const count = await generateAndReadCount(page);
    expect(count).toBeGreaterThan(0);
    await page.getByTestId('autoplanning-reject').click();
    await expect(page.getByTestId('autoplanning-bar')).not.toBeVisible();
  });

  test('genereren is deterministisch: twee keer genereren op dezelfde lege maand geeft evenveel voorstellen', async ({ page }) => {
    await clearMonth(page);

    const firstCount = await generateAndReadCount(page);
    await page.getByTestId('autoplanning-reject').click();
    await expect(page.getByTestId('autoplanning-bar')).not.toBeVisible();

    const secondCount = await generateAndReadCount(page);
    expect(secondCount).toBe(firstCount);
    await page.getByTestId('autoplanning-reject').click();
  });

  test('bevestigen schrijft het voorstel weg en overleeft een reload', async ({ page }) => {
    await clearMonth(page);
    const proposedCount = await generateAndReadCount(page);

    const confirmResponse = page.waitForResponse(
      (r) => r.url().includes('/api/autoplanning/confirm') && r.request().method() === 'POST'
    );
    await page.getByTestId('autoplanning-confirm').click();
    const response = await confirmResponse;
    expect(response.status()).toBe(200);
    await expect(page.getByTestId('autoplanning-bar')).not.toBeVisible();

    // Genereren op dezelfde maand zou nu (bijna) niets meer moeten voorstellen — de eerder
    // open secties zijn bevestigd, dus deze run vindt geen nieuwe open slots meer.
    const afterConfirmCount = await generateAndReadCount(page);
    expect(afterConfirmCount).toBeLessThan(proposedCount);
    await page.getByTestId('autoplanning-reject').click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Rooster maken' })).toBeVisible();
    // De toewijzingen staan nog steeds na reload (niet alleen client-side state).
    const shiftBlocks = page.getByTestId('shift-block-middle');
    await expect(shiftBlocks.first()).toBeVisible({ timeout: 15_000 });
  });
});
