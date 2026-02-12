import { test, expect } from '@playwright/test'
import packageInfo from '../package.json' with { type: 'json' }

/**
 * PWA-Specific Tests - PlacaCompleta
 * Tests PWA mode behavior and features
 */

const BASE_URL = 'http://localhost:3000'

test.describe('PWA Mode', () => {
  test.use({
    // Simulate PWA standalone display mode
    colorScheme: 'light',
    viewport: { width: 375, height: 667 }, // iPhone SE dimensions
  })

  test.beforeEach(async ({ page, context }) => {
    // Add CSS media query to simulate standalone display mode
    await context.addInitScript(() => {
      // Override matchMedia to simulate PWA standalone mode
      const originalMatchMedia = window.matchMedia
      window.matchMedia = (query: string) => {
        if (query === '(display-mode: standalone)') {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          } as MediaQueryList
        }
        return originalMatchMedia(query)
      }
    })
    
    await page.goto(BASE_URL)
    // Wait for app to detect PWA mode
    await page.waitForTimeout(500)
  })

  test('should display app title in title bar when in PWA mode', async ({ page }) => {
    const titleBar = page.locator('.win-window__titlebar span').first()
    await expect(titleBar).toContainText('PlacaCompleta')
  })

  test('should hide email input field in PWA mode', async ({ page }) => {
    // Email input should not be visible
    const emailInput = page.locator('#email')
    await expect(emailInput).toBeHidden()
    
    // Placa input should still be visible
    const placaInput = page.locator('#placa')
    await expect(placaInput).toBeVisible()
  })

  test('should hide sample preview in PWA mode', async ({ page }) => {
    const samplePreview = page.locator('.sample-preview')
    await expect(samplePreview).toBeHidden()
  })

  test('should show "Consultar Placa" button text in PWA mode', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /Consultar Placa/i })
    await expect(submitButton).toBeVisible()
    
    // Should NOT show email button text
    const emailButton = page.getByRole('button', { name: /Receber Dados no E-mail/i })
    await expect(emailButton).toBeHidden()
  })

  test('should allow plate input in PWA mode', async ({ page }) => {
    const placaInput = page.locator('#placa')
    
    // Type a valid plate
    await placaInput.fill('ABC1D23')
    await expect(placaInput).toHaveValue('ABC1D23')
  })

  test('should validate plate format in PWA mode', async ({ page }) => {
    const placaInput = page.locator('#placa')
    const submitButton = page.getByRole('button', { name: /Consultar Placa/i })
    
    // Try invalid plate
    await placaInput.fill('123')
    await submitButton.click()
    
    // Should show error
    await expect(page.locator('.form-group__error')).toBeVisible()
    await expect(page.locator('.form-group__error')).toContainText(/inválida/i)
  })

  test('should format plate input correctly', async ({ page }) => {
    const placaInput = page.locator('#placa')

    // Type with special characters and wait for input event
    await placaInput.clear()
    await placaInput.type('abc-1d23')
    await page.waitForTimeout(100)
    await expect(placaInput).toHaveValue('ABC1D23')

    // Type lowercase and wait for input event
    await placaInput.clear()
    await placaInput.type('xyz9z99')
    await page.waitForTimeout(100)
    await expect(placaInput).toHaveValue('XYZ9Z99')
  })

  test('should show email prompt modal on first PWA submission', async ({ page, context }) => {
    // Clear localStorage to simulate first use
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(500)
    
    const placaInput = page.locator('#placa')
    const submitButton = page.getByRole('button', { name: /Consultar Placa/i })
    
    // Fill valid plate
    await placaInput.fill('ABC1D23')
    await submitButton.click()
    
    // Should show email prompt modal
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Configurar E-mail')
    
    // Should have email input in modal
    const modalEmailInput = page.locator('#pwa-email')
    await expect(modalEmailInput).toBeVisible()
  })

  test('should validate email in PWA prompt modal', async ({ page, context }) => {
    // Clear localStorage
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(500)
    
    // Trigger email prompt
    await page.locator('#placa').fill('ABC1D23')
    await page.getByRole('button', { name: /Consultar Placa/i }).click()
    
    // Enter invalid email
    const modalEmailInput = page.locator('#pwa-email')
    await modalEmailInput.fill('invalid-email')
    
    // Click save
    const saveButton = page.getByRole('button', { name: /Salvar e Continuar/i })
    await saveButton.click()
    
    // Should show error
    await expect(page.locator('.form-group__error')).toContainText(/E-mail inválido/i)
  })

  test('should save email and hide prompt on subsequent uses', async ({ page, context }) => {
    // Clear localStorage
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(500)
    
    // First submission - show prompt
    await page.locator('#placa').fill('ABC1D23')
    await page.getByRole('button', { name: /Consultar Placa/i }).click()
    
    // Fill valid email and save
    await page.locator('#pwa-email').fill('test@example.com')
    await page.getByRole('button', { name: /Salvar e Continuar/i }).click()
    
    // Email should be saved to localStorage
    const savedEmail = await page.evaluate(() => localStorage.getItem('pwa_email'))
    expect(savedEmail).toBe('test@example.com')
    
    // Modal should close
    await expect(page.locator('.modal-overlay')).toBeHidden()
  })

  test('should show email icon in titlebar when email is configured', async ({ page }) => {
    // Set email in localStorage
    await page.evaluate(() => localStorage.setItem('pwa_email', 'test@example.com'))
    await page.reload()
    await page.waitForTimeout(500)
    
    // Should show email icon in titlebar
    const emailIcon = page.locator('.win-window__titlebar-buttons span[title="Alterar e-mail"]')
    await expect(emailIcon).toBeVisible()
    await expect(emailIcon).toContainText('✉')
  })

  test('should allow changing email from titlebar', async ({ page }) => {
    // Set email in localStorage
    await page.evaluate(() => localStorage.setItem('pwa_email', 'old@example.com'))
    await page.reload()
    await page.waitForTimeout(500)
    
    // Click email icon
    const emailIcon = page.locator('.win-window__titlebar-buttons span[title="Alterar e-mail"]')
    await emailIcon.click()
    
    // Should show email prompt modal
    await expect(page.locator('.modal-overlay')).toBeVisible()
    
    // Should pre-fill with current email
    const modalEmailInput = page.locator('#pwa-email')
    await expect(modalEmailInput).toHaveValue('old@example.com')
    
    // Change email
    await modalEmailInput.fill('new@example.com')
    await page.getByRole('button', { name: /Salvar e Continuar/i }).click()
    
    // Should update localStorage
    const savedEmail = await page.evaluate(() => localStorage.getItem('pwa_email'))
    expect(savedEmail).toBe('new@example.com')
  })
})

test.describe('Non-PWA Mode (Web Browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('should NOT show version in title bar in web mode', async ({ page }) => {
    const titleBar = page.locator('.win-window__titlebar span').first()
    await expect(titleBar).toHaveText('PlacaCompleta')
    await expect(titleBar).not.toContainText('v')
  })

  test('should show email input field in web mode', async ({ page }) => {
    const emailInput = page.locator('#email')
    await expect(emailInput).toBeVisible()
  })

  test('should show sample preview in web mode', async ({ page }) => {
    const samplePreview = page.locator('.sample-preview')
    await expect(samplePreview).toBeVisible()
  })

  test('should show "Receber Dados no E-mail" button text in web mode', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /Receber Dados no E-mail/i })
    await expect(submitButton).toBeVisible()
  })

  test('should validate both email and plate in web mode', async ({ page }) => {
    const placaInput = page.locator('#placa')
    const emailInput = page.locator('#email')
    const submitButton = page.getByRole('button', { name: /Receber Dados/i })
    
    // Valid plate, invalid email
    await placaInput.fill('ABC1D23')
    await emailInput.fill('invalid-email')
    await submitButton.click()
    
    // Should show email error
    await expect(page.locator('.form-group__error')).toContainText(/E-mail inválido/i)
  })
})

test.describe('Responsive Behavior', () => {
  test('should work on mobile viewport (non-PWA)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)
    
    // Should still show email in mobile web
    const emailInput = page.locator('#email')
    await expect(emailInput).toBeVisible()
    
    // Window should be visible and properly sized
    const winWindow = page.locator('.win-window')
    await expect(winWindow).toBeVisible()
  })
})
