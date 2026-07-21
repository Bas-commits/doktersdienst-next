import { expect, test } from '@playwright/test';

type Credentials = { email?: string; password?: string };

async function signIn(page: import('@playwright/test').Page, credentials: Credentials) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(credentials.email!);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(credentials.password!);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('/rooster-inzien');
}

const deelnemerCredentials = {
  email: process.env.PLAYWRIGHT_PP_DEELNEMER_EMAIL,
  password: process.env.PLAYWRIGHT_PP_DEELNEMER_PASSWORD,
};
const secretarisCredentials = {
  email: process.env.PLAYWRIGHT_PP_SECRETARIS_EMAIL,
  password: process.env.PLAYWRIGHT_PP_SECRETARIS_PASSWORD,
};
const adminCredentials = {
  email: process.env.PLAYWRIGHT_PP_ADMIN_EMAIL,
  password: process.env.PLAYWRIGHT_PP_ADMIN_PASSWORD,
};

test.describe('Praktijkplanner deelnemer flow', () => {
  test.skip(
    !deelnemerCredentials.email || !deelnemerCredentials.password,
    'Set PLAYWRIGHT_PP_DEELNEMER_EMAIL and PLAYWRIGHT_PP_DEELNEMER_PASSWORD to run this flow.'
  );

  test('switches products and opens all personal screens', async ({ page }) => {
    await signIn(page, deelnemerCredentials);
    await page.getByTestId('header-section-switch').click();
    await expect(page).toHaveURL(/\/praktijkplanner\/activiteiten$/);
    await expect(page.getByRole('heading', { name: 'Activiteiten planner' })).toBeVisible();
    await expect(page.getByText('Afwezigheidsplanner dokter')).toBeVisible();
    await expect(page.getByText('Capaciteits rapportage')).toBeVisible();
    await expect(page.getByText('Absentie telling')).toBeVisible();

    await page.getByText('Afwezigheidsplanner dokter').click();
    await expect(page.getByRole('heading', { name: 'Afwezigheidsplanner dokter' })).toBeVisible();
    await page.getByTestId('header-section-switch').click();
    await expect(page).toHaveURL('/rooster-inzien');
  });
});

test.describe('Praktijkplanner secretaris flow', () => {
  test.skip(
    !secretarisCredentials.email || !secretarisCredentials.password,
    'Set PLAYWRIGHT_PP_SECRETARIS_EMAIL and PLAYWRIGHT_PP_SECRETARIS_PASSWORD to run this flow.'
  );

  test('opens group absence and capacity screens', async ({ page }) => {
    await signIn(page, secretarisCredentials);
    await page.getByTestId('header-section-switch').click();
    await page.getByText('Afwezigheidsplanner', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Afwezigheidsplanner' })).toBeVisible();
    await page.getByText('Capaciteit planner', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Capaciteit planner' })).toBeVisible();
    await page.getByText('Capaciteit overzicht', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Capaciteit overzicht' })).toBeVisible();
  });
});

test.describe('Praktijkplanner administrator flow', () => {
  test.skip(
    !adminCredentials.email || !adminCredentials.password,
    'Set PLAYWRIGHT_PP_ADMIN_EMAIL and PLAYWRIGHT_PP_ADMIN_PASSWORD to run this flow.'
  );

  test('opens Plannerbeheer', async ({ page }) => {
    await signIn(page, adminCredentials);
    await page.getByTestId('header-section-switch').click();
    await page.getByText('Plannerbeheer', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Plannerbeheer' })).toBeVisible();
  });
});
