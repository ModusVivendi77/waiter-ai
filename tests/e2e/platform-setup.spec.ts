import { expect, test } from '@playwright/test'

const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL
const adminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD

test.describe('platform setup workspace', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_SUPER_ADMIN_EMAIL and E2E_SUPER_ADMIN_PASSWORD to run setup E2E tests.')

  test('supports CSV preview and exposes QR sheet tools', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(adminEmail as string)
    await page.getByLabel('Password').fill(adminPassword as string)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL(/\/platform/)
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()

    await page.goto('/platform/setup')

    await expect(page.getByRole('heading', { name: 'Restaurant setup workspace' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print QR sheet' })).toBeVisible()

    await page
      .getByLabel('CSV rows')
      .fill('Drinks,"Tonic, Zero","Sugar-free mixer, bottled",4.50\nFood,Burger,Beef burger,12.00')

    await page.getByRole('button', { name: 'Preview CSV' }).click()

    await expect(page.getByText('Preview ready for 2 CSV row(s).')).toBeVisible()
    await expect(page.getByText('Tonic, Zero')).toBeVisible()
    await expect(page.getByText('Sugar-free mixer, bottled')).toBeVisible()
    await expect(page.getByText('EUR 4.50')).toBeVisible()
  })
})