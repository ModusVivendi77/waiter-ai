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

  test('ordering page offers language toggle, category nav and cart confirmation', async ({ page }) => {
    await page.goto('/t/X7k91Lm')

    // Customers have a language toggle even though the platform nav is hidden.
    await expect(page.getByRole('button', { name: 'Ελληνικά' })).toBeVisible()

    // A horizontal category bar lets customers jump to a category.
    await expect(page.getByRole('navigation', { name: 'Categories' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Categories' }).getByRole('button', { name: 'Starters' })).toBeVisible()

    // Adding an item shows a confirmation toast.
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: /Add to cart/ }).click()
    await expect(page.getByText('Added to cart')).toBeVisible()
  })

  test('order again pre-fills the cart from the previous order', async ({ page }) => {
    // First round: two burgers.
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()
    await page.getByRole('link', { name: 'Track order status' }).click()
    await page.waitForURL(/\/orders\//)

    // "Order again" takes the previous items to the menu and pre-fills the cart.
    await page.getByRole('button', { name: 'Order again' }).click()
    await page.waitForURL(/\/t\/X7k91Lm\?reorder=/)
    await expect(page.getByText(/items from your last order were added to the cart/i)).toBeVisible()

    const cartEntry = page.getByRole('listitem').filter({ hasText: 'Burger' }).first()
    await expect(cartEntry).toBeVisible()
    await expect(cartEntry.locator('.cart-stepper span')).toHaveText('2')

    // The customer can keep all or remove some before submitting.
    await cartEntry.locator('.cart-stepper button').first().click()
    await expect(cartEntry.locator('.cart-stepper span')).toHaveText('1')

    // Submitting creates a fresh order (new tracking token + order number).
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()
  })
})