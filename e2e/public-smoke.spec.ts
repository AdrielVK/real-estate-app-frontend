import { expect, test } from '@playwright/test';

test.describe('public portal smoke journeys', () => {
  test('renders the public home page', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Encontrá el lugar donde empieza tu próxima etapa',
      }),
    ).toBeVisible();
    await expect(page.getByRole('form', { name: 'Búsqueda de propiedades' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Propiedades destacadas' })).toBeVisible();
  });

  test('navigates to the public publications route', async ({ page }) => {
    await page.goto('/publications');

    await expect(page).toHaveURL('/publications');
    await expect(page.getByRole('heading', { name: 'Publicaciones' })).toBeVisible();
    await expect(page.getByText('Explorá todas las propiedades disponibles.')).toBeVisible();
  });

  test('submits the home search and reaches the search route', async ({ page }) => {
    await page.goto('/');

    const locationInput = page.getByRole('combobox', { name: 'Zona, barrio o dirección' });
    await locationInput.fill('Alberdi');
    await locationInput.press('Enter');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();

    await expect(page).toHaveURL(/\/buscar\?operationType=alquiler&locationTexts=Alberdi$/);
    await expect(page.getByRole('heading', { name: 'Buscar propiedades' })).toBeVisible();
    await expect(page.getByText('API_BASE_URL is not configured')).toBeVisible();
  });
});
