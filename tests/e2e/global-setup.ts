import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...')

  // Create browser instance
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Wait for the app to be ready
    console.log('🔍 Checking if app is ready...')
    await page.goto('http://localhost:3000')
    await page.waitForSelector('body', { timeout: 30000 })
    console.log('✅ App is ready')

    // Setup test data if needed
    // This could include:
    // - Creating test users
    // - Seeding database
    // - Setting up test environment

    console.log('🗄️ Setting up test data...')

    // Example: Create test user via API or UI
    // await setupTestUser(page)

    console.log('✅ Global setup completed')
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

export default globalSetup