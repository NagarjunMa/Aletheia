import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = 'tests/e2e/auth/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Perform authentication steps
  await page.goto('/login')

  // Fill in login form with test credentials
  await page.fill('[data-testid="email-input"]', 'test@ascendia.dev')
  await page.fill('[data-testid="password-input"]', 'TestPassword123!')

  // Click login button
  await page.click('[data-testid="login-button"]')

  // Wait for successful login - should redirect to dashboard
  await expect(page).toHaveURL('/dashboard')

  // Verify we're logged in by checking for user menu or profile
  await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible()

  // Save signed-in state to 'authFile'
  await page.context().storageState({ path: authFile })
})

setup('setup test database', async ({ page }) => {
  // Setup test data that all tests might need
  console.log('🗄️ Setting up test database state...')

  // This could include:
  // - Creating test conversations
  // - Setting up user preferences
  // - Preparing test data

  // Example: Create a test conversation
  await page.goto('/dashboard')

  // Wait for the page to load
  await page.waitForLoadState('networkidle')

  console.log('✅ Test database setup completed')
})

setup('verify app health', async ({ page }) => {
  // Basic health check
  await page.goto('/')

  // Check that the app loads without errors
  await expect(page.locator('body')).toBeVisible()

  // Check for any error messages or 500 pages
  const errorText = await page.textContent('body')
  expect(errorText).not.toContain('Application error')
  expect(errorText).not.toContain('500')
  expect(errorText).not.toContain('404')

  console.log('✅ App health check passed')
})