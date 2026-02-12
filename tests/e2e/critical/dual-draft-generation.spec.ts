import { test, expect } from '@playwright/test'

test.describe('Dual Draft Generation - Critical Journey @critical', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints to avoid real AI calls in tests
    await page.route('**/api/streaming/**', async route => {
      const url = new URL(route.request().url())

      if (url.pathname.includes('grammar-fix')) {
        // Mock grammar fix response
        const stream = new ReadableStream({
          start(controller) {
            const chunks = ['Hello', ', could', ' you', ' help', ' me', ' write', ' an', ' email', '?']
            let index = 0

            const sendChunk = () => {
              if (index < chunks.length) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      type: 'content',
                      text: chunks[index],
                      progress: Math.round((index + 1) / chunks.length * 100)
                    })}\n\n`
                  )
                )
                index++
                setTimeout(sendChunk, 100)
              } else {
                controller.enqueue(
                  new TextEncoder().encode('data: {"type":"complete","cpl_score":75}\n\n')
                )
                controller.close()
              }
            }
            sendChunk()
          }
        })

        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          body: stream
        })
      } else if (url.pathname.includes('adaptive-polish')) {
        // Mock adaptive polish response
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          body: 'data: {"type":"content","text":"Dear [Boss Name],","progress":20}\n\ndata: {"type":"content","text":" I am writing","progress":40}\n\ndata: {"type":"complete","cpl_score":92}\n\n'
        })
      }
    })

    await page.goto('/')
  })

  test('complete dual draft generation workflow', async ({ page }) => {
    // Start new conversation
    await page.click('[data-testid="new-conversation"]')
    await expect(page.locator('[data-testid="editor-interface"]')).toBeVisible()

    // Input original content
    const originalContent = 'hey can u help me write an email to my boss about the project delay'
    await page.fill('[data-testid="content-input"]', originalContent)

    // Verify content input
    await expect(page.locator('[data-testid="content-input"]')).toHaveValue(originalContent)

    // Set target CPL
    await page.fill('[data-testid="target-cpl-input"]', '85')

    // Generate dual drafts
    await page.click('[data-testid="generate-drafts-button"]')

    // Verify generation starts
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible({ timeout: 5000 })

    // Wait for streaming to complete
    await expect(page.locator('[data-testid="grammar-draft-complete"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="polish-draft-complete"]')).toBeVisible({ timeout: 15000 })

    // Verify both drafts are generated
    const grammarDraft = page.locator('[data-testid="grammar-draft-content"]')
    const polishDraft = page.locator('[data-testid="polish-draft-content"]')

    await expect(grammarDraft).toBeVisible()
    await expect(polishDraft).toBeVisible()

    // Verify content is different from original
    const grammarText = await grammarDraft.textContent()
    const polishText = await polishDraft.textContent()

    expect(grammarText).not.toBe(originalContent)
    expect(polishText).not.toBe(originalContent)
    expect(grammarText).not.toBe(polishText)

    // Check CPL scores are displayed
    await expect(page.locator('[data-testid="grammar-cpl-score"]')).toContainText('75')
    await expect(page.locator('[data-testid="polish-cpl-score"]')).toContainText('92')

    // Verify CPL improvement indicators
    await expect(page.locator('[data-testid="cpl-improvement-grammar"]')).toBeVisible()
    await expect(page.locator('[data-testid="cpl-improvement-polish"]')).toBeVisible()

    // Test draft comparison mode
    await page.click('[data-testid="compare-drafts-button"]')
    await expect(page.locator('[data-testid="side-by-side-comparison"]')).toBeVisible()

    // Verify original text is shown for comparison
    await expect(page.locator('[data-testid="original-text-comparison"]')).toContainText(originalContent)

    // Select preferred draft (adaptive polish)
    await page.click('[data-testid="select-polish-draft"]')
    await expect(page.locator('[data-testid="selected-draft-indicator"]')).toBeVisible()

    // Edit selected draft
    await page.click('[data-testid="edit-selected-draft"]')
    await expect(page.locator('[data-testid="draft-editor-modal"]')).toBeVisible()

    const editorTextarea = page.locator('[data-testid="draft-editor-textarea"]')
    const currentContent = await editorTextarea.inputValue()
    const editedContent = currentContent + ' Thank you for your understanding.'

    await editorTextarea.fill(editedContent)
    await page.click('[data-testid="save-draft-edits"]')

    // Verify edits are saved
    await expect(page.locator('[data-testid="draft-editor-modal"]')).not.toBeVisible()
    await expect(polishDraft).toContainText('Thank you for your understanding.')

    // Accept final draft
    await page.click('[data-testid="accept-draft-button"]')
    await expect(page.locator('[data-testid="draft-accepted-message"]')).toBeVisible()

    // Verify draft is saved to conversation
    await page.click('[data-testid="conversation-history"]')
    await expect(page.locator('[data-testid="accepted-draft-item"]')).toBeVisible()
  })

  test('handles streaming interruption gracefully', async ({ page }) => {
    await page.click('[data-testid="new-conversation"]')

    // Start generation
    await page.fill('[data-testid="content-input"]', 'Test content for interruption')
    await page.click('[data-testid="generate-drafts-button"]')

    // Wait for streaming to start
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible()

    // Simulate network interruption by navigating away
    await page.goto('/dashboard')

    // Navigate back
    await page.goBack()

    // Should show reconnection interface
    await expect(page.locator('[data-testid="streaming-reconnect-banner"]')).toBeVisible({ timeout: 10000 })

    // Test manual reconnection
    await page.click('[data-testid="reconnect-streaming-button"]')
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible()
  })

  test('validates input requirements', async ({ page }) => {
    await page.click('[data-testid="new-conversation"]')

    // Try to generate without content
    await page.click('[data-testid="generate-drafts-button"]')
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Content is required')

    // Try with too short content
    await page.fill('[data-testid="content-input"]', 'Hi')
    await page.click('[data-testid="generate-drafts-button"]')
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Content must be at least 10 characters')

    // Try with invalid CPL target
    await page.fill('[data-testid="content-input"]', 'This is a valid length message for testing')
    await page.fill('[data-testid="target-cpl-input"]', '150')
    await page.click('[data-testid="generate-drafts-button"]')
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('CPL target must be between 1 and 100')

    // Valid input should proceed
    await page.fill('[data-testid="target-cpl-input"]', '75')
    await page.click('[data-testid="generate-drafts-button"]')
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible()
  })

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/streaming/**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })

    await page.click('[data-testid="new-conversation"]')
    await page.fill('[data-testid="content-input"]', 'Test content for error handling')
    await page.click('[data-testid="generate-drafts-button"]')

    // Should show error message
    await expect(page.locator('[data-testid="generation-error"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="error-message"]')).toContainText('failed to generate')

    // Should offer retry option
    await expect(page.locator('[data-testid="retry-generation-button"]')).toBeVisible()

    // Test retry functionality
    await page.click('[data-testid="retry-generation-button"]')
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible()
  })

  test('tracks user analytics events', async ({ page }) => {
    // Mock analytics calls
    let analyticsEvents: string[] = []

    await page.route('**/api/analytics/**', async route => {
      const body = await route.request().postDataJSON()
      analyticsEvents.push(body.event)
      await route.fulfill({ status: 200, body: '{"success": true}' })
    })

    await page.click('[data-testid="new-conversation"]')
    await page.fill('[data-testid="content-input"]', 'Test analytics tracking')
    await page.click('[data-testid="generate-drafts-button"]')

    // Wait for completion
    await expect(page.locator('[data-testid="grammar-draft-complete"]')).toBeVisible({ timeout: 15000 })

    await page.click('[data-testid="accept-draft-button"]')

    // Verify analytics events were tracked
    expect(analyticsEvents).toContain('ai_generation_started')
    expect(analyticsEvents).toContain('ai_generation_completed')
    expect(analyticsEvents).toContain('draft_accepted')
  })
})