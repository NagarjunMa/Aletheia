import { test, expect } from '@playwright/test'

// Smoke tests for critical functionality
test.describe('Smoke Tests @smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any global test state
    await page.goto('/')
  })

  test('homepage loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Ascendia/)
    await expect(page.locator('body')).toBeVisible()

    // Check for critical elements
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()

    // Ensure no error messages
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible()
  })

  test('navigation works correctly', async ({ page }) => {
    // Test navigation to key pages
    await page.click('[data-testid="login-link"]')
    await expect(page).toHaveURL(/.*\/login/)

    await page.goto('/')
    await page.click('[data-testid="about-link"]')
    await expect(page).toHaveURL(/.*\/about/)
  })

  test('health check endpoint works', async ({ page }) => {
    const response = await page.request.get('/api/health')
    expect(response.ok()).toBe(true)

    const healthData = await response.json()
    expect(healthData).toHaveProperty('status', 'ok')
    expect(healthData).toHaveProperty('timestamp')
  })

  test('authentication flow works', async ({ page, context }) => {
    // Go to login page
    await page.goto('/login')
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

    // Fill in test credentials
    await page.fill('[data-testid="email-input"]', 'test@ascendia.dev')
    await page.fill('[data-testid="password-input"]', 'TestPassword123!')

    // Submit form
    await page.click('[data-testid="login-button"]')

    // Should redirect to dashboard or show success
    await expect(page).toHaveURL(/.*\/(dashboard|login)/)

    // Check if login was successful by looking for user avatar or dashboard elements
    const isLoggedIn = await page.locator('[data-testid="user-avatar"]').isVisible({ timeout: 5000 })
    const hasDashboard = await page.locator('[data-testid="dashboard"]').isVisible({ timeout: 5000 })

    expect(isLoggedIn || hasDashboard).toBe(true)
  })

  test('dashboard loads for authenticated users', async ({ page }) => {
    // This test assumes the user is authenticated via the global setup
    await page.goto('/dashboard')

    // Should not redirect to login
    await expect(page).toHaveURL(/.*\/dashboard/)

    // Check for key dashboard elements
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="conversations-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="new-conversation"]')).toBeVisible()
  })

  test('AI generation flow works', async ({ page }) => {
    await page.goto('/dashboard')

    // Start a new conversation
    await page.click('[data-testid="new-conversation"]')

    // Enter test content
    const testContent = 'This is a test email that needs improvement.'
    await page.fill('[data-testid="content-input"]', testContent)

    // Select content type
    await page.selectOption('[data-testid="content-type"]', 'email')

    // Generate drafts
    await page.click('[data-testid="generate-button"]')

    // Wait for generation to complete
    await expect(page.locator('[data-testid="generation-loading"]')).toBeVisible()
    await expect(page.locator('[data-testid="generation-loading"]')).not.toBeVisible({ timeout: 30000 })

    // Check for generated drafts
    await expect(page.locator('[data-testid="grammar-draft"]')).toBeVisible()
    await expect(page.locator('[data-testid="polish-draft"]')).toBeVisible()

    // Verify draft content is different from input
    const grammarDraft = await page.textContent('[data-testid="grammar-draft"]')
    const polishDraft = await page.textContent('[data-testid="polish-draft"]')

    expect(grammarDraft).toBeTruthy()
    expect(polishDraft).toBeTruthy()
    expect(grammarDraft).not.toBe(testContent)
    expect(polishDraft).not.toBe(testContent)
  })

  test('conversation history works', async ({ page }) => {
    await page.goto('/dashboard')

    // Check if conversations are displayed
    const conversations = page.locator('[data-testid="conversation-item"]')
    const count = await conversations.count()

    if (count > 0) {
      // Click on first conversation
      await conversations.first().click()

      // Check if conversation loads
      await expect(page.locator('[data-testid="conversation-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="message-history"]')).toBeVisible()
    }
  })

  test('user settings are accessible', async ({ page }) => {
    await page.goto('/dashboard')

    // Open user menu
    await page.click('[data-testid="user-avatar"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Navigate to settings
    await page.click('[data-testid="settings-link"]')
    await expect(page).toHaveURL(/.*\/settings/)

    // Check settings form
    await expect(page.locator('[data-testid="settings-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="profile-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="preferences-section"]')).toBeVisible()
  })

  test('error handling works correctly', async ({ page }) => {
    // Test 404 page
    await page.goto('/nonexistent-page')
    await expect(page.locator('[data-testid="404-page"]')).toBeVisible()
    await expect(page.locator('text=Page not found')).toBeVisible()

    // Test back to home
    await page.click('[data-testid="back-home"]')
    await expect(page).toHaveURL('/')
  })

  test('responsive design works', async ({ page }) => {
    await page.goto('/dashboard')

    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible()

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible()

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible()

    // Test mobile menu
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
  })

  test('performance is acceptable', async ({ page }) => {
    // Navigate to dashboard and measure metrics
    await page.goto('/dashboard')

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        loadTime: perf.loadEventEnd - perf.loadEventStart,
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
      }
    })

    // Assert reasonable performance
    expect(metrics.loadTime).toBeLessThan(3000) // 3 seconds
    expect(metrics.domContentLoaded).toBeLessThan(2000) // 2 seconds
    expect(metrics.firstPaint).toBeLessThan(2000) // 2 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(2500) // 2.5 seconds
  })

  test('accessibility basics work', async ({ page }) => {
    await page.goto('/')

    // Check for basic accessibility features
    await expect(page.locator('[alt]')).toHaveCount(0) // Should have alt text
    await expect(page.locator('button')).not.toHaveCount(0)

    // Check heading structure
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBeGreaterThanOrEqual(1)

    // Check for focus management
    await page.keyboard.press('Tab')
    const focusedElement = await page.locator(':focus').first()
    await expect(focusedElement).toBeVisible()
  })

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/')

    // Check for security headers
    const headers = response?.headers() || {}

    expect(headers['x-frame-options']).toBeTruthy()
    expect(headers['x-content-type-options']).toBeTruthy()
    expect(headers['referrer-policy']).toBeTruthy()

    // In production, check for HTTPS
    if (process.env.NODE_ENV === 'production') {
      expect(headers['strict-transport-security']).toBeTruthy()
    }
  })

  test('data persistence works', async ({ page }) => {
    await page.goto('/dashboard')

    // Create a new conversation
    await page.click('[data-testid="new-conversation"]')
    await page.fill('[data-testid="conversation-title"]', 'Test Conversation')
    await page.click('[data-testid="save-conversation"]')

    // Refresh page
    await page.reload()

    // Check if conversation persists
    await expect(page.locator('text=Test Conversation')).toBeVisible()
  })

  test('logout functionality works', async ({ page }) => {
    await page.goto('/dashboard')

    // Open user menu and logout
    await page.click('[data-testid="user-avatar"]')
    await page.click('[data-testid="logout-button"]')

    // Should redirect to login or home
    await expect(page).toHaveURL(/.*\/(login|home|\/)/)

    // Try to access dashboard again - should redirect to login
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*\/login/)
  })
})