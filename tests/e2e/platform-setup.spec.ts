import { expect, test, type Page } from '@playwright/test'

const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL
const adminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD

async function loginAsSuperAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(adminEmail as string)
  await page.getByLabel('Password').fill(adminPassword as string)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/platform/)
}

test.describe('platform setup workspace', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_SUPER_ADMIN_EMAIL and E2E_SUPER_ADMIN_PASSWORD to run setup E2E tests.')

  test('supports CSV preview and exposes QR sheet tools', async ({ page }) => {
    await loginAsSuperAdmin(page)
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()

    await page.goto('/platform/setup')

    await expect(page.getByRole('heading', { name: 'Restaurant setup workspace' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print QR sheet' })).toBeVisible()

    // Regression guard: every QR code must render fully inside its card box
    // (they previously overflowed because the card's implicit grid column was
    // sized by the URL text's max-content, wider than the card itself).
    await expect(page.locator('.qr-sheet .qr-card .qr-svg svg').first()).toBeVisible({ timeout: 15000 })
    const qrsInsideCards = await page.locator('.qr-sheet .qr-card').evaluateAll((cards) =>
      cards.every((card) => {
        const svg = card.querySelector('.qr-svg svg')
        if (!svg) return true
        const cardBox = card.getBoundingClientRect()
        const svgBox = svg.getBoundingClientRect()
        return (
          svgBox.width <= cardBox.width + 1 &&
          svgBox.height <= cardBox.height + 1 &&
          svgBox.left >= cardBox.left - 1 &&
          svgBox.right <= cardBox.right + 1
        )
      })
    )
    expect(qrsInsideCards).toBe(true)

    await page
      .getByLabel('CSV rows')
      .fill('Drinks,"Tonic, Zero","Sugar-free mixer, bottled",4.50\nFood,Burger,Beef burger,12.00')

    await page.getByRole('button', { name: 'Preview CSV' }).click()

    await expect(page.getByText('Preview ready for 2 CSV row(s).')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Tonic, Zero' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Sugar-free mixer, bottled' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'EUR 4.50' })).toBeVisible()
  })

  test('anonymous visitors only see the login page', async ({ page }) => {
    await page.goto('/platform/orders')
    await page.waitForURL(/\/login/)
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()

    // The root landing page is also login-only for anonymous visitors.
    await page.goto('/')
    await page.waitForURL(/\/login/)
  })

  test('handles rename, import, and cleanup flows', async ({ page }) => {
    const unique = Date.now().toString()
    const tableName = `E2E Table ${unique}`
    const renamedTableName = `E2E Table Renamed ${unique}`
    const categoryName = `E2E Category ${unique}`
    const itemName = `E2E Item ${unique}`

    await loginAsSuperAdmin(page)
    await page.goto('/platform/setup')

    await page.getByLabel('New table name').fill(tableName)
    await page.getByRole('button', { name: 'Add table' }).click()
    await expect(page.getByText('Table created with a fresh QR token.')).toBeVisible()

    const createdTable = page.locator('li').filter({ hasText: tableName }).first()
    await createdTable.getByRole('button', { name: 'Rename' }).click()
    await page.locator('input[id^="edit-table-"]').fill(renamedTableName)
    await page.getByRole('button', { name: 'Save name' }).click()
    await expect(page.locator('li').filter({ hasText: renamedTableName }).first()).toBeVisible()

    await page.getByLabel('CSV rows').fill(`${categoryName},${itemName},Imported by Playwright,6.20`)
    await page.getByRole('button', { name: 'Preview CSV' }).click()
    await page.getByRole('button', { name: 'Import preview' }).click()
    await expect(page.getByText('Imported 1 rows from CSV.')).toBeVisible()

    // Menu items now render as rows in a category table; the name is an input value.
    // Wait for the imported item to actually render before scanning for its row.
    await page.locator(`.preview-table input[value="${itemName}"]`).waitFor({ timeout: 10000 })

    const findItemRow = async (name: string) => {
      const rows = page.locator('.preview-table tbody tr')
      const count = await rows.count()
      for (let i = 0; i < count; i++) {
        const value = await rows.nth(i).locator('input').first().inputValue().catch(() => '')
        if (value === name) {
          return rows.nth(i)
        }
      }
      return null
    }

    const importedItem = await findItemRow(itemName)
    expect(importedItem).not.toBeNull()
    await importedItem!.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.locator('.preview-table input[value="' + itemName + '"]')).toHaveCount(0)

    const importedCategory = page
      .locator('div.cart-line-header')
      .filter({ has: page.getByText(categoryName, { exact: true }) })
      .first()
    await importedCategory.getByRole('button', { name: 'Delete category' }).click()
    await expect(page.getByText(categoryName, { exact: true })).toHaveCount(0)

    const renamedTable = page.locator('li').filter({ hasText: renamedTableName }).first()
    await renamedTable.getByRole('button', { name: 'Delete table' }).click()
    await expect(page.locator('li').filter({ hasText: renamedTableName })).toHaveCount(0)
  })

  test('imports CSV with a header row and Greek translation columns', async ({ page }) => {
    const unique = Date.now().toString()
    const categoryName = `E2E EL Category ${unique}`
    const itemName = `E2E EL Item ${unique}`
    const itemNameEl = `Προϊόν Ε2Ε ${unique}`
    const descriptionEl = `Περιγραφή προϊόντος ${unique}`

    await loginAsSuperAdmin(page)
    await page.goto('/platform/setup')

    // Header row format: category,name,description,price,name_el,description_el
    await page.getByLabel('CSV rows').fill(
      `category,name,description,price,name_el,description_el\n` +
        `${categoryName},${itemName},Imported with Greek,6.20,${itemNameEl},${descriptionEl}`
    )
    await page.getByRole('button', { name: 'Preview CSV' }).click()

    // The preview table shows the parsed Greek columns. The menu's per-category
    // tables share the same class, so scope to the one with the Greek headers.
    const preview = page.locator('table.preview-table').filter({ hasText: 'Name (EL)' })
    await expect(preview).toBeVisible()
    await expect(preview.getByText(itemNameEl, { exact: true })).toBeVisible()
    await expect(preview.getByText(descriptionEl, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Import preview' }).click()
    await expect(page.getByText('Imported 1 rows from CSV.')).toBeVisible()

    // The imported item appears with its English name in the menu table.
    await page.locator(`.preview-table input[value="${itemName}"]`).waitFor({ timeout: 10000 })
    await expect(page.locator(`.preview-table input[value="${itemName}"]`)).toHaveCount(1)

    // Cleanup: remove the imported item and its category.
    const rows = page.locator('.preview-table tbody tr')
    const count = await rows.count()
    for (let i = 0; i < count; i++) {
      const value = await rows.nth(i).locator('input').first().inputValue().catch(() => '')
      if (value === itemName) {
        await rows.nth(i).getByRole('button', { name: 'Delete', exact: true }).click()
        break
      }
    }
    await expect(page.locator(`.preview-table input[value="${itemName}"]`)).toHaveCount(0)

    const importedCategory = page
      .locator('div.cart-line-header')
      .filter({ has: page.getByText(categoryName, { exact: true }) })
      .first()
    await importedCategory.getByRole('button', { name: 'Delete category' }).click()
    await expect(page.getByText(categoryName, { exact: true })).toHaveCount(0)
  })
})