import { vi } from 'vitest'

/**
 * Testing utilities for streaming functionality
 */

// Stream testing helpers
export class StreamTestUtils {
  // Create a mock readable stream
  static createMockReadableStream(chunks: string[], delay: number = 100): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    let index = 0

    return new ReadableStream({
      start(controller) {
        const sendChunk = () => {
          if (index < chunks.length) {
            const chunk = `data: ${JSON.stringify({ text: chunks[index] })}\n\n`
            controller.enqueue(encoder.encode(chunk))
            index++
            setTimeout(sendChunk, delay)
          } else {
            controller.close()
          }
        }
        sendChunk()
      }
    })
  }

  // Create a mock SSE response
  static createMockSSEResponse(chunks: string[], delay: number = 100): Response {
    const stream = this.createMockReadableStream(chunks, delay)
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }

  // Collect chunks from a stream
  static async collectStreamChunks(stream: ReadableStream): Promise<string[]> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        chunks.push(text)
      }
    } finally {
      reader.releaseLock()
    }

    return chunks
  }

  // Parse SSE chunks
  static parseSSEChunks(chunks: string[]): Array<{ type: string; data: any }> {
    const events: Array<{ type: string; data: any }> = []

    for (const chunk of chunks) {
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            events.push({ type: 'data', data })
          } catch {
            events.push({ type: 'data', data: line.slice(6) })
          }
        } else if (line.startsWith('event: ')) {
          events.push({ type: 'event', data: line.slice(7) })
        } else if (line === '') {
          events.push({ type: 'end', data: null })
        }
      }
    }

    return events
  }

  // Create async generator for testing
  static async *createMockAsyncGenerator(
    items: string[],
    delay: number = 100,
    errorAt?: number
  ): AsyncGenerator<string, void, unknown> {
    for (let i = 0; i < items.length; i++) {
      if (errorAt !== undefined && i === errorAt) {
        throw new Error(`Mock error at index ${errorAt}`)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
      yield items[i]
    }
  }

  // Test stream performance
  static async measureStreamPerformance(
    createStream: () => ReadableStream,
    expectedChunkCount: number
  ): Promise<{
    totalTime: number
    firstChunkTime: number
    avgChunkInterval: number
    throughput: number
  }> {
    const startTime = performance.now()
    let firstChunkTime = 0
    let chunkCount = 0
    const chunkTimes: number[] = []

    const stream = createStream()
    const reader = stream.getReader()

    try {
      while (true) {
        const { done } = await reader.read()
        if (done) break

        const currentTime = performance.now()
        if (chunkCount === 0) {
          firstChunkTime = currentTime - startTime
        }
        chunkTimes.push(currentTime)
        chunkCount++
      }
    } finally {
      reader.releaseLock()
    }

    const totalTime = performance.now() - startTime
    const avgChunkInterval = chunkTimes.length > 1
      ? (chunkTimes[chunkTimes.length - 1] - chunkTimes[0]) / (chunkTimes.length - 1)
      : 0

    return {
      totalTime,
      firstChunkTime,
      avgChunkInterval,
      throughput: chunkCount / (totalTime / 1000) // chunks per second
    }
  }
}

// Mock AI streaming service
export class MockStreamingAIService {
  private chunks: string[]
  private delay: number

  constructor(chunks: string[], delay: number = 100) {
    this.chunks = chunks
    this.delay = delay
  }

  async *streamCompletion(prompt: string): AsyncGenerator<string, void, unknown> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, this.delay))

    for (const chunk of this.chunks) {
      await new Promise(resolve => setTimeout(resolve, this.delay))
      yield chunk
    }
  }

  createStreamingResponse(prompt: string): Response {
    return StreamTestUtils.createMockSSEResponse(this.chunks, this.delay)
  }

  // Simulate different streaming scenarios
  static createTestScenarios() {
    return {
      // Normal completion
      normal: new MockStreamingAIService([
        'This is ',
        'a test ',
        'streaming ',
        'response.'
      ], 50),

      // Fast streaming
      fast: new MockStreamingAIService([
        'Fast', 'response', 'here'
      ], 10),

      // Slow streaming
      slow: new MockStreamingAIService([
        'Slow...', 'response...', 'here.'
      ], 500),

      // Long content
      long: new MockStreamingAIService(
        Array.from({ length: 50 }, (_, i) => `Chunk ${i + 1} `),
        30
      ),

      // Empty response
      empty: new MockStreamingAIService([], 100),

      // Single chunk
      single: new MockStreamingAIService(['Complete response'], 100)
    }
  }
}

// Mock useCompletion hook for testing
export const createMockUseCompletion = (scenario: 'success' | 'error' | 'loading' = 'success') => {
  const mockScenarios = {
    success: {
      completion: 'Mock completion result',
      complete: vi.fn().mockResolvedValue('Mock completion result'),
      isLoading: false,
      error: null,
      stop: vi.fn(),
      setCompletion: vi.fn()
    },
    error: {
      completion: '',
      complete: vi.fn().mockRejectedValue(new Error('Mock error')),
      isLoading: false,
      error: new Error('Mock error'),
      stop: vi.fn(),
      setCompletion: vi.fn()
    },
    loading: {
      completion: 'Partial completion...',
      complete: vi.fn(),
      isLoading: true,
      error: null,
      stop: vi.fn(),
      setCompletion: vi.fn()
    }
  }

  return mockScenarios[scenario]
}

// Streaming test patterns
export const streamingTestPatterns = {
  // Test real-time updates
  testRealTimeUpdates: async (
    streamingComponent: any,
    expectedUpdates: string[]
  ) => {
    const updates: string[] = []

    // Mock the streaming function to capture updates
    const mockStream = vi.fn().mockImplementation((text: string) => {
      updates.push(text)
    })

    // Simulate streaming
    for (const update of expectedUpdates) {
      mockStream(update)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return updates
  },

  // Test error handling during streaming
  testStreamingErrorHandling: async (
    streamFunction: () => AsyncGenerator<string, void, unknown>,
    errorAtChunk: number
  ) => {
    const receivedChunks: string[] = []
    let errorCaught = false

    try {
      let chunkIndex = 0
      for await (const chunk of streamFunction()) {
        if (chunkIndex === errorAtChunk) {
          throw new Error('Simulated streaming error')
        }
        receivedChunks.push(chunk)
        chunkIndex++
      }
    } catch (error) {
      errorCaught = true
    }

    return { receivedChunks, errorCaught }
  },

  // Test streaming cancellation
  testStreamingCancellation: async (
    createStream: () => ReadableStream,
    cancelAfterChunks: number
  ) => {
    const stream = createStream()
    const reader = stream.getReader()
    let chunkCount = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunkCount++
        if (chunkCount >= cancelAfterChunks) {
          await reader.cancel()
          break
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { chunkCount, cancelled: chunkCount >= cancelAfterChunks }
  }
}

// Performance testing for streams
export const streamPerformanceTests = {
  // Test throughput
  testThroughput: async (
    createStream: () => ReadableStream,
    expectedChunks: number,
    timeoutMs: number = 5000
  ) => {
    const startTime = performance.now()
    let chunkCount = 0

    const stream = createStream()
    const reader = stream.getReader()

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stream timeout')), timeoutMs)
    })

    try {
      await Promise.race([
        (async () => {
          while (true) {
            const { done } = await reader.read()
            if (done) break
            chunkCount++
          }
        })(),
        timeoutPromise
      ])
    } finally {
      reader.releaseLock()
    }

    const duration = performance.now() - startTime
    return {
      chunkCount,
      expectedChunks,
      duration,
      throughput: chunkCount / (duration / 1000),
      success: chunkCount === expectedChunks
    }
  },

  // Test memory usage during streaming
  testMemoryUsage: async (
    createStream: () => ReadableStream,
    checkInterval: number = 100
  ) => {
    const memorySnapshots: number[] = []

    const stream = createStream()
    const reader = stream.getReader()

    // Start memory monitoring
    const memoryMonitor = setInterval(() => {
      if (process.memoryUsage) {
        memorySnapshots.push(process.memoryUsage().heapUsed)
      }
    }, checkInterval)

    try {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    } finally {
      clearInterval(memoryMonitor)
      reader.releaseLock()
    }

    return {
      initialMemory: memorySnapshots[0] || 0,
      finalMemory: memorySnapshots[memorySnapshots.length - 1] || 0,
      peakMemory: Math.max(...memorySnapshots),
      memoryDelta: (memorySnapshots[memorySnapshots.length - 1] || 0) - (memorySnapshots[0] || 0)
    }
  }
}

// Stream assertion utilities
export const streamAssertions = {
  expectStreamToComplete: async (stream: ReadableStream, timeoutMs: number = 5000) => {
    let completed = false

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stream did not complete within timeout')), timeoutMs)
    })

    const completionPromise = (async () => {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done } = await reader.read()
          if (done) {
            completed = true
            break
          }
        }
      } finally {
        reader.releaseLock()
      }
    })()

    await Promise.race([completionPromise, timeoutPromise])
    return completed
  },

  expectStreamChunks: async (stream: ReadableStream, expectedChunks: string[]) => {
    const actualChunks = await StreamTestUtils.collectStreamChunks(stream)
    const decoder = new TextDecoder()
    const decodedChunks = actualChunks.map(chunk => decoder.decode(new TextEncoder().encode(chunk)))

    return {
      actual: decodedChunks,
      expected: expectedChunks,
      matches: JSON.stringify(decodedChunks) === JSON.stringify(expectedChunks)
    }
  },

  expectStreamError: async (stream: ReadableStream, expectedError: RegExp | string) => {
    let errorCaught = false
    let actualError: Error | null = null

    try {
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
      reader.releaseLock()
    } catch (error) {
      errorCaught = true
      actualError = error instanceof Error ? error : new Error(String(error))
    }

    if (!errorCaught) {
      throw new Error('Expected stream to error, but it completed successfully')
    }

    if (expectedError instanceof RegExp) {
      if (!expectedError.test(actualError?.message || '')) {
        throw new Error(`Expected error message to match ${expectedError}, got: ${actualError?.message}`)
      }
    } else {
      if (actualError?.message !== expectedError) {
        throw new Error(`Expected error message "${expectedError}", got: "${actualError?.message}"`)
      }
    }

    return true
  }
}