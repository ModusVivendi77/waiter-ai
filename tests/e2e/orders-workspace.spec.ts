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
    await expect(customerPage.getByText('Restaurant accepted', { exact: true })).toBeVisible({ timeout: 3500 })
    await expect(customerPage.getByText(/is currently ACCEPTED/i)).toBeVisible({ timeout: 3500 })
  })

  test('orders can be filtered by status and sorted', async ({ page }) => {
    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    // Status "categories" render as tabs, each with a count.
    for (const tabName of ['All', 'New', 'Accepted', 'Preparing', 'Ready', 'Served', 'Closed']) {
      await expect(page.getByRole('tab', { name: new RegExp(tabName) })).toBeVisible()
    }

    // Sort orders by workflow status.
    await page.getByLabel('Sort orders').selectOption('status')

    // Filter to NEW orders only: every visible card must be NEW (or the list is empty).
    await page.getByRole('tab', { name: /New/ }).click()
    await expect(page.getByRole('tab', { name: /New/ })).toHaveAttribute('aria-selected', 'true')

    const orderCards = page.locator('[data-testid^="order-card-"]')
    const cardCount = await orderCards.count()
    if (cardCount > 0) {
      for (let i = 0; i < cardCount; i++) {
        await expect(orderCards.nth(i).getByText(/Status: NEW/)).toBeVisible()
      }
    } else {
      await expect(page.getByText('No orders match this filter.')).toBeVisible()
    }
  })

  test('home dashboard notifies the owner of a new order in realtime', async ({ browser }) => {
    const context = await browser.newContext()
    const customerPage = await context.newPage()
    const ownerPage = await context.newPage()

    // Owner opens the home dashboard for Green Bar.
    await ownerPage.addInitScript((restaurantId: string) => {
      localStorage.setItem('staffHomeRestaurantId', restaurantId)
    }, greenBarRestaurantId)
    await loginAsSuperAdmin(ownerPage)
    await ownerPage.goto('/platform')
    await expect(ownerPage.getByText('Live orders')).toBeVisible()

    // Customer places an order.
    await customerPage.goto('/t/X7k91Lm')
    await customerPage.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await customerPage.getByRole('button', { name: 'Submit order' }).click()
    await expect(customerPage.getByText(/submitted with status NEW/i)).toBeVisible()

    // The owner's dashboard must show the realtime new-order banner.
    await expect(ownerPage.getByText(/New order received/)).toBeVisible({ timeout: 10000 })

    // Accept moves the order to ACCEPTED and dismisses the banner.
    await ownerPage.getByRole('button', { name: 'Accept' }).click()
    await expect(ownerPage.getByText(/moved to ACCEPTED/i)).toBeVisible()
    await expect(ownerPage.getByText(/New order received/)).toBeHidden()
  })

  test('live tables expose orders and expandable order summaries', async ({ page }) => {
    // Place an order on Table 1 so it has at least one linked order.
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    // Select The Green Bar on the home dashboard.
    await page.addInitScript((restaurantId: string) => {
      localStorage.setItem('staffHomeRestaurantId', restaurantId)
    }, greenBarRestaurantId)

    await loginAsSuperAdmin(page)
    await page.goto('/platform')
    await expect(page.getByText('Live tables')).toBeVisible()

    const tableCard = page.locator('article.metric').filter({ hasText: 'Table 1' }).first()
    await tableCard.getByRole('button', { name: 'Show orders' }).click()
    await expect(tableCard.getByRole('button', { name: 'Hide orders' })).toBeVisible()

    // Clicking an order row expands the customer-style summary (line items + total).
    const firstOrderRow = tableCard.locator('ul.list li button').first()
    await firstOrderRow.click()
    await expect(tableCard.getByText('Total')).toBeVisible()
    await expect(tableCard.getByText('Burger')).toBeVisible()
  })

  test('add item to an order uses a searchable picker', async ({ page }) => {
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    const orderCard = page.locator('[data-testid^="order-card-"]').first()
    await expect(orderCard).toBeVisible()

    // Search narrows the menu items instead of a long dropdown.
    await orderCard.getByLabel('Search menu items').fill('Burger')
    await orderCard.getByRole('button', { name: /Burger/ }).first().click()
    await expect(orderCard.getByText('Selected:')).toBeVisible()

    await orderCard.getByRole('button', { name: 'Add item to order' }).click()
    // The confirmation notice renders at the top of the workspace, not inside the card.
    await expect(page.getByText(/added to order/i)).toBeVisible()
  })
})