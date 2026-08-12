import { expect, test } from '@playwright/test'

test.describe('public ordering journey', () => {
  test('loads seeded QR menu and updates cart totals', async ({ page }) => {
    await page.goto('/t/X7k91Lm')

    await expect(page.getByRole('heading', { name: 'The Green Bar' })).toBeVisible()
    await expect(page.getByText('You are ordering for Table 1.')).toBeVisible()

    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()

    const cartEntry = page.getByRole('listitem').filter({ hasText: 'Burger' }).first()
    await expect(cartEntry).toBeVisible()
    await expect(cartEntry.getByText('€12.00')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit order' })).toBeEnabled()
  })
})