import { expect, test } from '@playwright/test'

test.describe('public ordering journey', () => {
  test('submits a public order and opens the tracking surface', async ({ page }) => {
    const uniqueNote = `E2E public order ${Date.now()}`

    await page.goto('/t/X7k91Lm')

    await expect(page.getByRole('heading', { name: 'The Green Bar' })).toBeVisible()
    await expect(page.getByText('You are ordering for Table 1.')).toBeVisible()

    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()

    const cartEntry = page.getByRole('listitem').filter({ hasText: 'Burger' }).first()
    await expect(cartEntry).toBeVisible()
    await expect(cartEntry.getByText('€12.00')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit order' })).toBeEnabled()

    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()

    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()
    await page.getByRole('link', { name: 'Track order status' }).click()
    await page.waitForURL(/\/orders\//)
    await expect(page.getByRole('heading', { name: 'The Green Bar' })).toBeVisible()
    await expect(page.getByText(uniqueNote)).toBeVisible()
  })

  test('restores an active order after the customer refreshes the table page', async ({ page }) => {
    const uniqueNote = `E2E refresh order ${Date.now()}`

    await page.goto('/t/X7k91Lm')

    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    // Simulate the customer closing/reopening the QR page (or hitting refresh):
    // the stored tracking token must take them straight back to their order.
    await page.reload()
    await page.waitForURL(/\/orders\//)
    await expect(page.getByRole('heading', { name: 'The Green Bar' })).toBeVisible()
    await expect(page.getByText(uniqueNote)).toBeVisible()
    await expect(page.getByText(/is currently NEW/i)).toBeVisible()
  })

  test('customer tracking page is minimal and offers a new order', async ({ page }) => {
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()
    await page.getByRole('link', { name: 'Track order status' }).click()
    await page.waitForURL(/\/orders\//)

    // Customers do not see the platform navigation bar.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)

    // They can start a new order from the same table.
    await page.getByRole('button', { name: 'New order' }).click()
    await page.waitForURL(/\/t\/X7k91Lm/)
    await expect(page.getByRole('heading', { name: 'The Green Bar' })).toBeVisible()
    await expect(page.getByText('You are ordering for Table 1.')).toBeVisible()
  })
})