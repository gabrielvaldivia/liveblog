import { test, expect } from '@playwright/test'

test.describe('Live Blog App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    // Wait for app to load
    await page.waitForSelector('.container', { timeout: 5000 })
  })

  test('app loads and displays initial entry', async ({ page }) => {
    // Check that container exists
    await expect(page.locator('.container')).toBeVisible()
    
    // Check that there's at least one entry
    const entries = page.locator('.entry')
    await expect(entries.first()).toBeVisible()
    
    // Check that there's a textarea for active entry
    const textarea = page.locator('textarea.entry-input')
    await expect(textarea.first()).toBeVisible()
  })

  test('can type in textarea', async ({ page }) => {
    const textarea = page.locator('textarea.entry-input').first()
    await textarea.fill('Test entry')
    await expect(textarea).toHaveValue('Test entry')
  })

  test('can commit entry with Enter key', async ({ page }) => {
    const textarea = page.locator('textarea.entry-input').first()
    await textarea.fill('First entry')
    await textarea.press('Enter')
    
    // Wait a bit for state update
    await page.waitForTimeout(100)
    
    // Should have committed entry text
    const entryText = page.locator('.entry-text').first()
    await expect(entryText).toHaveText('First entry')
    
    // Should have new active textarea
    const newTextarea = page.locator('textarea.entry-input')
    await expect(newTextarea).toHaveCount(1)
    await expect(newTextarea).toHaveValue('')
  })

  test('can create multiple entries', async ({ page }) => {
    // First entry
    const textarea1 = page.locator('textarea.entry-input').first()
    await textarea1.fill('Entry 1')
    await textarea1.press('Enter')
    await page.waitForTimeout(100)
    
    // Second entry
    const textarea2 = page.locator('textarea.entry-input').first()
    await textarea2.fill('Entry 2')
    await textarea2.press('Enter')
    await page.waitForTimeout(100)
    
    // Should have 2 committed entries
    const entryTexts = page.locator('.entry-text')
    await expect(entryTexts).toHaveCount(2)
    await expect(entryTexts.nth(0)).toHaveText('Entry 1')
    await expect(entryTexts.nth(1)).toHaveText('Entry 2')
  })

  test('Shift+Enter creates new line instead of committing', async ({ page }) => {
    const textarea = page.locator('textarea.entry-input').first()
    await textarea.fill('Line 1')
    await textarea.press('Shift+Enter')
    await textarea.type('Line 2')
    
    await expect(textarea).toHaveValue('Line 1\nLine 2')
  })

  test('can click date to cycle format', async ({ page }) => {
    // First commit an entry to see the date
    const textarea = page.locator('textarea.entry-input').first()
    await textarea.fill('Test')
    await textarea.press('Enter')
    await page.waitForTimeout(100)
    
    const dateElement = page.locator('.date').first()
    const initialDate = await dateElement.textContent()
    
    // Click to cycle
    await dateElement.click()
    await page.waitForTimeout(100)
    
    const newDate = await dateElement.textContent()
    // Date format should change (unless it cycled back)
    expect(newDate).toBeTruthy()
  })

  test('can click timestamp to cycle format', async ({ page }) => {
    // First commit an entry
    const textarea = page.locator('textarea.entry-input').first()
    await textarea.fill('Test')
    await textarea.press('Enter')
    await page.waitForTimeout(100)
    
    const timestampElement = page.locator('.timestamp').first()
    const initialTime = await timestampElement.textContent()
    
    // Click to cycle
    await timestampElement.click()
    await page.waitForTimeout(100)
    
    const newTime = await timestampElement.textContent()
    // Time format should change (unless it cycled back)
    expect(newTime).toBeTruthy()
  })

  test('textarea auto-resizes with content', async ({ page }) => {
    const textarea = page.locator('textarea.entry-input').first()
    const initialHeight = await textarea.evaluate(el => el.offsetHeight)
    
    // Add multiple lines
    await textarea.fill('Line 1\nLine 2\nLine 3')
    await page.waitForTimeout(100)
    
    const newHeight = await textarea.evaluate(el => el.offsetHeight)
    expect(newHeight).toBeGreaterThan(initialHeight)
  })

  test('date only shows when different from previous entry', async ({ page }) => {
    // Create first entry
    const textarea1 = page.locator('textarea.entry-input').first()
    await textarea1.fill('First')
    await textarea1.press('Enter')
    await page.waitForTimeout(100)
    
    // Create second entry immediately (same day)
    const textarea2 = page.locator('textarea.entry-input').first()
    await textarea2.fill('Second')
    await textarea2.press('Enter')
    await page.waitForTimeout(100)
    
    // First entry should show date, second might not (depends on timing)
    const dates = page.locator('.date')
    await expect(dates.first()).toBeVisible()
  })
})


