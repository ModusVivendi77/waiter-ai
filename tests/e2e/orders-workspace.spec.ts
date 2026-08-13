import { expect, test, type Page } from '@playwright/test'

const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL
const adminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD
const greenBarRestaurantId = 'ed7eef90-8b33-400a-9c36-2922ad8e3c5e'

async function loginAsSuperAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(adminEmail as string)
  await page.getByLabel('Password').fill(adminPassword as string)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/platform/)
}

test.describe('orders workspace', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_SUPER_ADMIN_EMAIL and E2E_SUPER_ADMIN_PASSWORD to run orders E2E tests.')

  test('restaurant staff tooling can modify a submitted order', async ({ page }) => {
    const uniqueNote = `E2E ops order ${Date.now()}`

    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    const orderCard = page.locator('[data-testid^="order-card-"]').first()
    await expect(orderCard).toBeVisible()

    await orderCard.getByRole('button', { name: 'ACCEPTED' }).click()
    await expect(page.getByText(/moved to ACCEPTED/i)).toBeVisible()

    await orderCard.locator('input[id^="line-qty-"]').first().fill('2')
    await orderCard.getByRole('button', { name: 'Save line' }).first().click()
    await expect(page.getByText('Order line updated.')).toBeVisible()
  })

  test('broadcast: order acceptance updates the customer tracking history panel without waiting for the poll', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const customerPage = await context.newPage()
    const adminPage = await context.newPage()

    const uniqueNote = `E2E broadcast order ${Date.now()}`

    // Customer: place a public order and stay on the tracking page.
    await customerPage.goto('/t/X7k91Lm')
    await customerPage.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await customerPage.getByLabel('Order note').fill(uniqueNote)
    await customerPage.getByRole('button', { name: 'Submit order' }).click()
    await expect(customerPage.getByText(/submitted with status NEW/i)).toBeVisible()

    await customerPage.getByRole('link', { name: 'Track order status' }).click()
    await customerPage.waitForURL(/\/orders\//)
    await expect(customerPage.getByRole('heading', { name: 'The Green Bar' })).toBeVisible()
    await expect(customerPage.getByText(uniqueNote)).toBeVisible()

    // Admin: accept the order on the staff workspace.
    await loginAsSuperAdmin(adminPage)
    await adminPage.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(adminPage.getByText('Restaurant: The Green Bar')).toBeVisible()

    const orderCard = adminPage.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote }).first()
    await expect(orderCard).toBeVisible()

    await orderCard.getByRole('button', { name: 'ACCEPTED' }).click()
    await expect(adminPage.getByText(/moved to ACCEPTED/i)).toBeVisible()

    // The tracking page must show the accepted state (and its history entry) quickly.
    // Broadcast delivers instantly; the 5-second poll is only the fallback, so a
    // short timeout proves the real-time path is working.
    await expect(customerPage.getByText('Restaurant accepted')).toBeVisible({ timeout: 3500 })
    await expect(customerPage.getByText(/is currently ACCEPTED/i)).toBeVisible({ timeout: 3500 })
  })
})