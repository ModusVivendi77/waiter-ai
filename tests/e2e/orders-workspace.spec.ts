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
})