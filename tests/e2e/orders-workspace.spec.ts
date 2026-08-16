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

    // Live status "categories" render as tabs, each with a count. Terminal
    // statuses (Served/Cancelled/Rejected) live under Order history.
    for (const tabName of ['All', 'New', 'Accepted', 'Preparing', 'Ready']) {
      await expect(page.getByRole('tab', { name: new RegExp(tabName) })).toBeVisible()
    }

    const historyPanel = page.locator('[data-testid="order-history-panel"]')
    await historyPanel.getByRole('button', { name: /Show history/ }).click()
    for (const tabName of ['All', 'Served', 'Cancelled', 'Rejected']) {
      await expect(historyPanel.getByRole('tab', { name: new RegExp(tabName) })).toBeVisible()
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

    // The owner's dashboard must show the realtime new-order line.
    await expect(ownerPage.getByText(/🔔 New order #\d+ · Table 1 ·/)).toBeVisible({ timeout: 10000 })

    // Accept moves the order to ACCEPTED and dismisses the notification line.
    await ownerPage.getByRole('button', { name: 'Accept' }).click()
    await expect(ownerPage.getByText(/moved to ACCEPTED/i)).toBeVisible()
    await expect(ownerPage.getByText(/🔔 New order #\d+ · Table 1 ·/)).toBeHidden()
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
    // The compact orders toggle shows the count + total and expands the list.
    const ordersToggle = tableCard.locator('.table-card-orders-toggle')
    await expect(ordersToggle).toContainText('item(s)')
    await ordersToggle.click()
    await expect(tableCard.locator('.table-card-order-list').first()).toBeVisible()

    // Clicking an order row expands the customer-style summary (line items + total).
    const firstOrderRow = tableCard.locator('.table-card-order-list button').first()
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

    // Staff: close the table's dining session — this completes the still-open
    // order (SERVED) and moves it out of live orders.
    const adminPage = await contextA.newPage()
    await loginAsSuperAdmin(adminPage)
    await adminPage.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(adminPage.getByText('Restaurant: The Green Bar')).toBeVisible()

    const orderCard = adminPage.locator('[data-testid^="order-card-"]').filter({ hasText: noteA }).first()
    await expect(orderCard).toBeVisible()

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

  test('top nav shows the signed-in account name with a sign-out action', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // The nav no longer shows a "Sign in" link while a session exists; instead it
    // shows the account (full name when set, email otherwise) plus sign-out.
    const navUser = page.locator('.global-nav-user')
    await expect(navUser).toBeVisible()
    const accountText = (await navUser.textContent())?.trim()
    expect(accountText?.length).toBeGreaterThan(0)
    expect(accountText).not.toMatch(/Sign in/i)

    const signOut = page.getByRole('button', { name: 'Sign out' })
    await expect(signOut).toBeVisible()
    await signOut.click()
    await page.waitForURL(/\/login/)
    await expect(page.locator('.global-nav-login')).toBeVisible()
  })

  test('new order shows a tab-title + Orders-nav badge and clears when Orders opens', async ({ browser }) => {
    const context = await browser.newContext()
    const adminPage = await context.newPage()

    // Staff: stay on the Home dashboard while a customer orders.
    await adminPage.addInitScript((restaurantId: string) => {
      localStorage.setItem('staffHomeRestaurantId', restaurantId)
    }, greenBarRestaurantId)
    await loginAsSuperAdmin(adminPage)
    await adminPage.goto('/platform')
    await expect(adminPage.getByText('Live orders')).toBeVisible()

    const titleBefore = await adminPage.title()

    // Customer: place a fresh order in a sibling tab.
    const customerPage = await context.newPage()
    await customerPage.goto('/t/X7k91Lm')
    await customerPage.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await customerPage.getByRole('button', { name: 'Submit order' }).click()
    await expect(customerPage.getByText(/submitted with status NEW/i)).toBeVisible()

    // The staff tab (even in the background) flags it in the document title…
    await expect
      .poll(() => adminPage.title())
      .toMatch(/\(1\) 🔔 New order/)
    expect(await adminPage.title()).toContain(titleBefore)

    // …and the "Orders" nav link shows a Facebook-style count badge.
    const ordersLink = adminPage.locator('.global-nav-link').filter({ hasText: 'Orders' })
    await expect(ordersLink.locator('.global-nav-badge')).toHaveText('1', { timeout: 10000 })

    // The Home dashboard also surfaces the expandable new-order line.
    await expect(adminPage.getByText(/🔔 New order #\d+ · Table 1 ·/)).toBeVisible({ timeout: 10000 })

    // Opening the Orders workspace counts as "seen": badge and title clear.
    await adminPage.bringToFront()
    await ordersLink.click()
    await adminPage.waitForURL(/\/platform\/orders/)
    await expect(adminPage.locator('.global-nav-badge')).toHaveCount(0)
    await expect.poll(() => adminPage.title()).toBe(titleBefore)

    await context.close()
  })

  test('terminal orders leave live orders and move to order history', async ({ page }) => {
    const uniqueNote = `E2E history ${Date.now()}`

    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    // The fresh NEW order is a live order.
    const liveCard = page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote }).first()
    await expect(liveCard).toBeVisible()

    // Mark it SERVED: it must leave the live list immediately.
    await liveCard.getByRole('button', { name: 'SERVED' }).click()
    await expect(page.getByText(/moved to SERVED/i)).toBeVisible()
    await expect(page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote })).toHaveCount(0)

    // And it must appear under Order history with its status.
    const historyPanel = page.locator('[data-testid="order-history-panel"]')
    await historyPanel.getByRole('button', { name: /Show history/ }).click()
    const historyItem = historyPanel.locator('li').filter({ hasText: uniqueNote }).first()
    await expect(historyItem).toBeVisible()
    await expect(historyItem.getByText('SERVED', { exact: true })).toBeVisible()
  })

  test('closing a table session completes its open orders (leaves live orders)', async ({ page }) => {
    const uniqueNote = `E2E close session ${Date.now()}`

    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    const liveCard = page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote }).first()
    await expect(liveCard).toBeVisible()

    // Closing the table completes the still-open (NEW) order.
    page.once('dialog', (dialog) => void dialog.accept())
    await liveCard.getByRole('button', { name: 'Close table session' }).click()
    await expect(page.getByText(/session for Table 1 closed/i)).toBeVisible()
    await expect(page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote })).toHaveCount(0)

    // The order now lives in history as SERVED.
    const historyPanel = page.locator('[data-testid="order-history-panel"]')
    await historyPanel.getByRole('button', { name: /Show history/ }).click()
    const historyItem = historyPanel.locator('li').filter({ hasText: uniqueNote }).first()
    await expect(historyItem).toBeVisible()
    await expect(historyItem.getByText('SERVED', { exact: true })).toBeVisible()
  })

  test('home live tables let the owner assign staff and close a table (completes its orders)', async ({ page }) => {
    const uniqueNote = `E2E home close ${Date.now()}`

    // Customer: open an active session on Table 1 of the Green Bar.
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await page.addInitScript((restaurantId: string) => {
      localStorage.setItem('staffHomeRestaurantId', restaurantId)
    }, greenBarRestaurantId)
    await loginAsSuperAdmin(page)
    await page.goto('/platform')
    await expect(page.getByText('Live tables')).toBeVisible()

    // The occupied table card exposes the assign control + close button, and
    // the old "Claim table" action is gone entirely.
    const tableCard = page.locator('.panel-grid article.metric').filter({ hasText: 'Table 1' }).first()
    await expect(tableCard).toHaveClass(/table-card-occupied/)
    await expect(tableCard.locator('.table-card-status')).toHaveText('Occupied')
    await expect(tableCard.getByLabel('Assign table to')).toBeVisible()
    await expect(tableCard.getByRole('button', { name: 'Assign' })).toBeVisible()
    await expect(tableCard.getByRole('button', { name: /Claim/ })).toHaveCount(0)
    const closeTable = tableCard.getByRole('button', { name: 'Close table' })
    await expect(closeTable).toBeVisible()

    // Closing the table completes its still-open order and starts a new visit.
    page.once('dialog', (dialog) => void dialog.accept())
    await closeTable.click()
    await expect(page.getByText(/Table 1 closed/i)).toBeVisible()
    await expect(tableCard.getByRole('button', { name: 'Close table' })).toHaveCount(0)
    await expect(tableCard).toHaveClass(/table-card-free/)
    await expect(tableCard.locator('.table-card-status')).toHaveText('Free')

    // A closed/free table starts a new visit: it must not list the previous
    // visit's orders anymore.
    await expect(tableCard.locator('.table-card-order-list')).toHaveCount(0)
    await expect(tableCard.getByText('No orders yet')).toBeVisible()
  })

  test('orders page shows a floating back-to-top button after scrolling', async ({ page }) => {
    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    // Hidden at the top of the page.
    await expect(page.locator('.up-float')).toHaveCount(0)

    // Appears once the order list has been scrolled, and a click returns to top.
    await page.evaluate(() => window.scrollTo(0, 1200))
    await expect(page.locator('.up-float')).toBeVisible()
    await page.locator('.up-float').click()
    await page.waitForFunction(() => window.scrollY === 0)
    await expect(page.locator('.up-float')).toHaveCount(0)

    // The "Test sound" button exists in the toolbar (clicking it is a user
    // gesture, which is what unlocks the chime for later realtime alerts).
    await expect(page.getByRole('button', { name: /Test sound/ })).toBeVisible()
  })

  test('compact order lines keep their edit controls and render inline', async ({ page }) => {
    const uniqueNote = `E2E compact lines ${Date.now()}`

    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    const orderCard = page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote }).first()
    await expect(orderCard).toBeVisible()

    // Each item is a compact two-row block: a header line with qty × name and
    // the line total, plus an inline control row with the edit actions.
    const line = orderCard.locator('.order-line').first()
    await expect(line).toBeVisible()
    await expect(line.locator('.order-line-name')).toContainText('1 × Burger')
    await expect(line.locator('input[id^="line-qty-"]')).toBeVisible()
    await expect(line.getByRole('button', { name: 'Save line' })).toBeVisible()
    await expect(line.getByRole('button', { name: 'Remove line' })).toBeVisible()
  })

  test('home dashboard collapse toggles are visible and collapse the panels', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // Both stacked panels expose a visible text toggle (default expanded).
    const livePanel = page.locator('.panel.stack').filter({ hasText: 'Live orders' }).first()
    const historyPanel = page.locator('.panel.stack').filter({ hasText: 'Order history' }).first()
    await expect(livePanel.getByRole('button', { name: 'Collapse' })).toBeVisible()
    await expect(historyPanel.getByRole('button', { name: 'Collapse' })).toBeVisible()

    // Collapsing the live-orders panel hides its content and flips the toggle.
    const hadLiveOrders = (await livePanel.locator('ul.list li').count()) > 0
    await livePanel.getByRole('button', { name: 'Collapse' }).click()
    await expect(livePanel.getByRole('button', { name: 'Expand' })).toBeVisible()
    if (hadLiveOrders) {
      await expect(livePanel.locator('ul.list li').first()).toBeHidden()
    }

    // Expanding brings the content back.
    await livePanel.getByRole('button', { name: 'Expand' }).click()
    await expect(livePanel.getByRole('button', { name: 'Collapse' })).toBeVisible()
  })

  test('workspace order status line is localized in Greek', async ({ page }) => {
    const uniqueNote = `E2E greek status ${Date.now()}`

    // Place a fresh order as a customer so there is guaranteed card content.
    await page.goto('/t/X7k91Lm')
    await page.locator('article').filter({ hasText: 'Burger' }).getByRole('button', { name: 'Add to cart' }).click()
    await page.getByLabel('Order note').fill(uniqueNote)
    await page.getByRole('button', { name: 'Submit order' }).click()
    await expect(page.getByText(/submitted with status NEW/i)).toBeVisible()

    await loginAsSuperAdmin(page)
    await page.goto(`/platform/orders?restaurantId=${greenBarRestaurantId}`)
    await expect(page.getByText('Restaurant: The Green Bar')).toBeVisible()

    const orderCard = page.locator('[data-testid^="order-card-"]').filter({ hasText: uniqueNote }).first()
    await expect(orderCard).toBeVisible()

    // In Greek the status line must show the translated label, never the raw
    // status code (regression: the card previously read "Κατάσταση: CANCELLED").
    await page.locator('.global-nav-lang').click()
    await expect(
      orderCard.getByText(
        /Κατάσταση: (Η παραγγελία λήφθηκε|Έγινε αποδεκτή|Ετοιμάζεται|Έτοιμη|Εξυπηρετήθηκε|Ακυρώθηκε|Απορρίφθηκε)/,
      ),
    ).toBeVisible()
    await expect(orderCard.getByText(/Κατάσταση: (NEW|ACCEPTED|PREPARING|READY|SERVED|CANCELLED|REJECTED)/)).toHaveCount(0)

    // The new-order sound toggle is localized in Greek too.
    await expect(page.getByRole('button', { name: /Ήχος νέας παραγγελίας: ενεργός/ })).toBeVisible()
  })
})