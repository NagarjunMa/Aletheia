import { vi } from 'vitest'

// Mock Anthropic API responses
export const mockAnthropicResponse = (content: string | { text: string }) => {
  const response = typeof content === 'string'
    ? { text: content }
    : content

  return {
    content: [{ text: response.text }],
    role: 'assistant',
    model: 'claude-3-sonnet-20240229',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 200
    }
  }
}

// Mock streaming response
export const mockAnthropicStream = (chunks: string[]) => {
  let index = 0

  return new ReadableStream({
    start(controller) {
      const sendChunk = () => {
        if (index < chunks.length) {
          const chunk = {
            type: 'content_block_delta',
            delta: {
              type: 'text_delta',
              text: chunks[index]
            }
          }

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify(chunk)}\n\n`
            )
          )

          index++
          setTimeout(sendChunk, 50) // 50ms delay between chunks
        } else {
          // Send completion event
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'message_stop' })}\n\n`
            )
          )
          controller.close()
        }
      }

      sendChunk()
    }
  })
}

// Mock the Anthropic client
export const mockAnthropicClient = {
  messages: {
    create: vi.fn().mockResolvedValue(
      mockAnthropicResponse('Mock AI response')
    ),
    stream: vi.fn().mockResolvedValue(
      mockAnthropicStream(['Mock ', 'streaming ', 'response'])
    )
  }
}

// Mock the entire Anthropic module
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => mockAnthropicClient),
  Anthropic: vi.fn().mockImplementation(() => mockAnthropicClient)
}))

// Helper functions for tests
export function mockGrammarFixResponse() {
  mockAnthropicClient.messages.create.mockResolvedValueOnce(
    mockAnthropicResponse(
      'Hello, could you help me write an email to my boss about the delay?'
    )
  )
}

export function mockAdaptivePolishResponse() {
  mockAnthropicClient.messages.create.mockResolvedValueOnce(
    mockAnthropicResponse(
      'Dear [Boss Name], I am writing to inform you of a delay in the project timeline. I would appreciate the opportunity to discuss this matter further at your convenience.'
    )
  )
}

export function mockCPLAnalysisResponse(score: number) {
  mockAnthropicClient.messages.create.mockResolvedValueOnce(
    mockAnthropicResponse({
      text: JSON.stringify({
        overall_score: score,
        grammar_score: score + 5,
        clarity_score: score - 2,
        style_score: score + 3,
        engagement_score: score - 1,
        vocabulary_score: score + 1,
        suggestions: [
          'Consider using more formal language',
          'Add transition sentences for better flow'
        ]
      })
    })
  )
}

export function mockStreamingResponse(chunks: string[]) {
  mockAnthropicClient.messages.stream.mockResolvedValueOnce(
    mockAnthropicStream(chunks)
  )
}

export function mockAnthropicError(error: string) {
  mockAnthropicClient.messages.create.mockRejectedValueOnce(
    new Error(error)
  )
}

// Reset mocks
export function resetAnthropicMocks() {
  mockAnthropicClient.messages.create.mockClear()
  mockAnthropicClient.messages.stream.mockClear()
}