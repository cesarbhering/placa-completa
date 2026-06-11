import { test, expect } from '@playwright/test'

/**
 * User Flow Tests - PlacaCompleta
 * Validates the main user journey and functionality
 */

const BASE_URL = 'http://localhost:3000'

test.describe('Homepage - Main Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('should load homepage successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/PlacaCompleta/)
    await expect(page.locator('h1')).toContainText('Consulta Veicular')
  })

  test('should display main form elements', async ({ page }) => {
    // Check form exists
    await expect(page.locator('form')).toBeVisible()

    // Check placa input
    await expect(page.locator('#placa')).toBeVisible()

    // Check submit button
    await expect(page.getByRole('button', { name: /Consultar Placa/i })).toBeVisible()
  })

  test('should show placeholder text in placa input', async ({ page }) => {
    const placaInput = page.locator('#placa')
    await expect(placaInput).toHaveAttribute('placeholder', /ABC1D23/i)
  })

  test('should display trust indicators', async ({ page }) => {
    await expect(page.locator('.trust-line')).toContainText(/100% grátis/i)
    await expect(page.locator('.trust-line')).toContainText(/Sem cadastro/i)
  })

  test('should display sample data preview', async ({ page }) => {
    const preview = page.locator('.sample-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/O que você recebe/i)
    await expect(preview).toContainText('Marca')
    await expect(preview).toContainText('Modelo')
    await expect(preview).toContainText('FIPE')
  })
})

test.describe('Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('placa input should have required attribute', async ({ page }) => {
    const placaInput = page.locator('#placa')
    await expect(placaInput).toHaveAttribute('required')
  })

  test('should accept valid placa format (old pattern)', async ({ page }) => {
    const placaInput = page.locator('#placa')

    // Old format: ABC1234
    await placaInput.fill('ABC1234')
    const value = await placaInput.inputValue()

    expect(value).toBe('ABC1234')
  })

  test('should accept valid placa format (mercosul)', async ({ page }) => {
    const placaInput = page.locator('#placa')

    // Mercosul format: ABC1D23
    await placaInput.fill('ABC1D23')
    const value = await placaInput.inputValue()

    expect(value).toBe('ABC1D23')
  })

  test('should convert placa to uppercase', async ({ page }) => {
    const placaInput = page.locator('#placa')

    // Use pressSequentially to type character by character and trigger input events
    await placaInput.click()
    await placaInput.pressSequentially('abc1d23', { delay: 50 })

    // Wait a bit for the conversion
    await page.waitForTimeout(100)

    const value = await placaInput.inputValue()
    expect(value).toBe('ABC1D23')
  })

  test('should limit placa to 7 characters', async ({ page }) => {
    const placaInput = page.locator('#placa')

    await placaInput.fill('ABC1D2399999')
    const value = await placaInput.inputValue()

    expect(value.length).toBeLessThanOrEqual(7)
  })

  test('should show email prompt modal when no email saved', async ({ page }) => {
    // Wait for Vue hydration
    await page.waitForLoadState('networkidle')

    // Fill a valid placa
    await page.locator('#placa').fill('ABC1D23')

    // Submit the form
    await page.getByRole('button', { name: /Consultar Placa/i }).click()

    // Email prompt modal should appear with the email input
    await expect(page.locator('#web-email')).toBeVisible({ timeout: 5000 })
  })

  test('should show email confirmation modal when email is saved', async ({ page, context }) => {
    const testEmail = 'test@email.com'

    // Pre-populate localStorage
    await context.addInitScript((email) => {
      localStorage.setItem('pc_email', email)
    }, testEmail)

    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)

    // Fill a valid placa
    await page.locator('#placa').fill('ABC1D23')

    // Submit the form
    await page.getByRole('button', { name: /Consultar Placa/i }).click()

    // Email confirmation modal should appear with saved email
    await expect(page.locator('text=/Confirmar E-mail/i')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.confirm-email')).toContainText(testEmail)
  })
})

test.describe('Navigation', () => {
  test('should navigate to footer links', async ({ page }) => {
    await page.goto(BASE_URL)

    // Test "Termos de Uso" link
    const termosLink = page.getByRole('link', { name: /Termos de Uso/i })
    await expect(termosLink).toBeVisible()
    await expect(termosLink).toHaveAttribute('href', '/termos-de-uso')

    // Test "Política de Privacidade" link
    const privacidadeLink = page.getByRole('link', { name: /Política de Privacidade/i })
    await expect(privacidadeLink).toBeVisible()
    await expect(privacidadeLink).toHaveAttribute('href', '/politica-de-privacidade')
  })

  test('should navigate to consulta placa page', async ({ page }) => {
    await page.goto(`${BASE_URL}/consulta-placa`)
    await expect(page).toHaveTitle(/Consulta de Placa/i)
    await expect(page.locator('h1')).toContainText(/Consulta de Placa/i)
  })

  test('should navigate to como consultar page', async ({ page }) => {
    await page.goto(`${BASE_URL}/como-consultar-placa`)
    await expect(page).toHaveTitle(/Como Consultar/i)
  })

  test('should navigate to tabela fipe page', async ({ page }) => {
    await page.goto(`${BASE_URL}/tabela-fipe`)
    await expect(page).toHaveTitle(/Tabela FIPE/i)
  })
})

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)

    // Check if elements are visible on mobile
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('#placa')).toBeVisible()
  })

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(BASE_URL)

    await expect(page.locator('form')).toBeVisible()
  })

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL)

    await expect(page.locator('form')).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('form inputs should have labels', async ({ page }) => {
    const placaLabel = page.locator('label[for="placa"]')
    await expect(placaLabel).toBeVisible()
  })

  test('email input in modal should have proper attributes', async ({ page }) => {
    // Wait for Vue hydration
    await page.waitForLoadState('networkidle')

    // Trigger the email prompt modal
    await page.locator('#placa').fill('ABC1D23')
    await page.getByRole('button', { name: /Consultar Placa/i }).click()

    // Wait for modal
    await expect(page.locator('#web-email')).toBeVisible({ timeout: 5000 })

    const emailInput = page.locator('#web-email')
    await expect(emailInput).toHaveAttribute('autocomplete', 'email')
  })

  test('form should have novalidate attribute', async ({ page }) => {
    const form = page.locator('form')
    await expect(form).toHaveAttribute('novalidate')
  })
})

test.describe('User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('placa input should be focusable and receive focus', async ({ page }) => {
    // Wait for page to be fully loaded and hydrated
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const placaInput = page.locator('#placa')

    // Verify element is visible and focusable
    await expect(placaInput).toBeVisible()
    await expect(placaInput).toBeEnabled()

    // Verify it can receive focus
    await placaInput.focus()
    await expect(placaInput).toBeFocused()
  })

  test('should load email from localStorage and show in confirmation modal', async ({ page, context }) => {
    const testEmail = 'saved@email.com'

    // Pre-populate localStorage before visiting page
    await context.addInitScript((email) => {
      localStorage.setItem('pc_email', email)
    }, testEmail)

    // Now visit the page
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Fill placa and submit
    await page.locator('#placa').fill('ABC1D23')
    await page.getByRole('button', { name: /Consultar Placa/i }).click()

    // Email confirmation modal should show the saved email
    await expect(page.locator('.confirm-email')).toContainText(testEmail, { timeout: 5000 })
  })

  test('should show counter if available', async ({ page }) => {
    // Counter may not always be visible, so we just check if element exists
    const counter = page.locator('.counter')
    const count = await counter.count()

    if (count > 0) {
      await expect(counter).toBeVisible()
      await expect(counter).toContainText(/consultas realizadas/i)
    }
  })
})
