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
    await expect(ownerPage.getByText(/🔔 Order \d+ — Table 1/)).toBeVisible({ timeout: 10000 })

    // Accept moves the order to ACCEPTED and dismisses the banner.
    await ownerPage.getByRole('button', { name: 'Accept' }).click()
    await expect(ownerPage.getByText(/moved to ACCEPTED/i)).toBeVisible()
    await expect(ownerPage.getByText(/🔔 Order \d+ — Table 1/)).toBeHidden()
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

    // Search narrows the menu items instead of a long dropdown. The quick
    // "+ {item}" repeat chips also match a bare /Burger/ query, so scope the
    // click to the search-result list (rendered as "Category - Name €price").
    await orderCard.getByLabel('Search menu items').fill('Burger')
    await orderCard.locator('ul.list button').filter({ hasText: / - Burger/ }).first().click()
    await expect(orderCard.getByText('Selected:')).toBeVisible()

    await orderCard.getByRole('button', { name: 'Add item to order' }).click()
    // The confirmation notice renders at the top of the workspace, not inside the card.
    await expect(page.getByText(/added to order/i)).toBeVisible()
  })

  test('staff can quickly add more of the items already in an order', async ({ page }) => {
    const uniqueNote = `E2E repeat line ${Date.now()}`
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    const orderCard = page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote }).first()
    await expect(orderCard).toBeVisible()

    // The "+ Burger" chip adds one more of the already-ordered item.
    await orderCard.getByRole('button', { name: '+ Burger' }).click()
    await expect(page.getByText(/added another burger/i)).toBeVisible()
  })

  test('closing a table session makes the next visit produce a distinct order', async ({ browser }) => {
    // First customers sit at Table 1 and place an order.
    const contextA = await browser.newContext()
    const customerA = await contextA.newPage()
    const noteA = `E2E visit 1 ${Date.now()}`
    await customerA.goto('/t/X7k91Lm')
    await customerA.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await customerA.getByLabel('Order note').fill(noteA)
    await customerA.getByRole('button', { name: 'Submit order' }).click()
    await expect(customerA.getByText(/submitted with status NEW/i)).toBeVisible()

    const firstSuccess = await customerA.locator('.success').first().textContent()
    const firstNumber = Number(firstSuccess?.match(/Order (\d+)/)?.[1])
    expect(firstNumber).toBeGreaterThan(0)
    const firstTrackHref = await customerA.locator('.success a').first().getAttribute('href')

    // Staff: serve the order, then close the table's dining session.
    const adminPage = await contextA.newPage()
    await loginAsSuperAdmin(adminPage)
    await adminPage.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(adminPage.getByText('Restaurant: The Green Bar')).toBeVisible()

    const orderCard = adminPage.locator('[data-testid^="order-card-"]').filter({ hasText: noteA }).first()
    await expect(orderCard).toBeVisible()
    await orderCard.getByRole('button', { name: 'SERVED' }).click()
    await expect(adminPage.getByText(/moved to SERVED/i)).toBeVisible()

    adminPage.once('dialog', (dialog) => void dialog.accept())
    await orderCard.getByRole('button', { name: 'Close table session' }).click()
    await expect(adminPage.getByText(/session for Table 1 closed/i)).toBeVisible()

    // New customers arrive at the same table with their own device (fresh browser
    // context = clean localStorage) and place a new order.
    const contextB = await browser.newContext()
    const customerB = await contextB.newPage()
    await customerB.goto('/t/X7k91Lm')
    await customerB.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await customerB.getByRole('button', { name: 'Submit order' }).click()
    await expect(customerB.getByText(/submitted with status NEW/i)).toBeVisible()

    const secondSuccess = await customerB.locator('.success').first().textContent()
    const secondNumber = Number(secondSuccess?.match(/Order (\d+)/)?.[1])
    expect(secondNumber).toBeGreaterThan(0)
    const secondTrackHref = await customerB.locator('.success a').first().getAttribute('href')

    // The next visit must be a completely separate order: a new sequential order
    // number and its own tracking token — never a continuation of the old visit.
    expect(secondNumber).toBeGreaterThan(firstNumber)
    expect(secondTrackHref).not.toBe(firstTrackHref)

    await contextA.close()
    await contextB.close()
  })
})