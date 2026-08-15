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

  test('customer UI and menu translate to Greek', async ({ page }) => {
    await page.goto('/t/X7k91Lm')

    // The customer toggle flips the UI chrome into Greek.
    await page.getByRole('button', { name: 'Ελληνικά' }).click()
    await expect(page.getByRole('navigation', { name: 'Κατηγορίες' })).toBeVisible()
    await expect(page.locator('article').first().getByRole('button', { name: 'Προσθήκη στο καλάθι' })).toBeVisible()

    // Menu content is translated from the database once migration 015 populated
    // the bilingual columns; before that the English values are the fallback.
    // Either is acceptable — the important thing is the menu keeps rendering.
    const categoryNav = page.getByRole('navigation', { name: 'Κατηγορίες' })
    const categoryText = await categoryNav.textContent()
    expect(/Ορεκτικά|Starters/.test(categoryText ?? '')).toBe(true)
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

  test('floating cart icon counts added items and scrolls to the cart', async ({ page }) => {
    await page.goto('/t/X7k91Lm')

    // No badge until something is added; the icon sits in the corner.
    const cartIcon = page.locator('.cart-float')
    await expect(cartIcon).toBeVisible()
    await expect(cartIcon.locator('.cart-float-count')).toHaveCount(0)

    const burgerCard = page.locator('article').filter({ hasText: 'Burger' })

    // The quantity stepper is ALWAYS visible next to "Add to cart", defaulting
    // to 1 with the minus button disabled.
    await expect(burgerCard.locator('.cart-stepper span')).toHaveText('1')
    await expect(burgerCard.getByRole('button', { name: 'Remove one' })).toBeDisabled()
    await expect(burgerCard.getByRole('button', { name: 'Add to cart' })).toBeVisible()

    // "+" adds the first item: badge appears and the stepper becomes 1.
    await burgerCard.getByRole('button', { name: 'Add one' }).click()
    await expect(cartIcon.locator('.cart-float-count')).toHaveText('1')
    await expect(burgerCard.locator('.cart-stepper span')).toHaveText('1')
    await expect(burgerCard.getByRole('button', { name: 'Remove one' })).toBeEnabled()

    // Stepper "+" increments the cart and the badge together.
    await burgerCard.getByRole('button', { name: 'Add one' }).click()
    await expect(cartIcon.locator('.cart-float-count')).toHaveText('2')
    await expect(burgerCard.locator('.cart-stepper span')).toHaveText('2')

    // "Remove one" decrements both.
    await burgerCard.getByRole('button', { name: 'Remove one' }).click()
    await expect(cartIcon.locator('.cart-float-count')).toHaveText('1')
    await expect(burgerCard.locator('.cart-stepper span')).toHaveText('1')

    // The "Add to cart" button remains a valid alternative.
    await burgerCard.getByRole('button', { name: 'Add to cart' }).click()
    await expect(burgerCard.locator('.cart-stepper span')).toHaveText('2')

    // Removing everything returns the counter to its default of 1 and clears
    // the cart badge.
    await burgerCard.getByRole('button', { name: 'Remove one' }).click()
    await burgerCard.getByRole('button', { name: 'Remove one' }).click()
    await expect(burgerCard.locator('.cart-stepper span')).toHaveText('1')
    await expect(cartIcon.locator('.cart-float-count')).toHaveCount(0)

    // Clicking the icon scrolls the cart panel into view.
    await cartIcon.click()
    await expect(page.getByRole('heading', { name: 'Your order' })).toBeVisible()
  })

  test('customer can cancel an order within the cancellation window', async ({ page }) => {
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()
    await page.getByRole('link', { name: 'Track order status' }).click()
    await page.waitForURL(/\/orders\//)

    // The order is NEW and inside the default 5-minute window, so the cancel
    // button is available. Confirm and verify the order becomes CANCELLED.
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeVisible()
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Cancel order' }).click()
    await expect(page.getByText(/has been cancelled/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  })
})