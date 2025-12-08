// Client-Side Streaming Implementation
// Created: December 7, 2024
// Purpose: Client-side utilities for consuming streaming responses

'use client'

import type { StreamingMessage } from './server'

export interface StreamingOptions {
  onStatus?: (status: string, data?: any) => void
  onContent?: (content: string, fullContent: string, data?: any) => void
  onProgress?: (progress: number, stage: string, data?: any) => void
  onCompleted?: (result: any) => void
  onError?: (error: string, data?: any) => void
  onConnectionChange?: (connected: boolean) => void
}

export class StreamingClient {
  private eventSource: EventSource | null = null
  private sessionId: string | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 1000

  constructor(private options: StreamingOptions = {}) {}

  // Start streaming processing
  async startStreaming(inputId: string, draftType: 'grammar_fix' | 'adaptive_polish', processingOptions?: any): Promise<boolean> {
    try {
      // First, start the processing session
      const response = await fetch('/api/stream/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputId,
          draftType,
          options: processingOptions,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        this.options.onError?.(errorData.error || 'Failed to start processing')
        return false
      }

      // For streaming responses, we need to handle the stream directly
      if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
        return this.handleStreamResponse(response)
      }

      this.options.onError?.('Unexpected response format')
      return false

    } catch (error) {
      console.error('Streaming start error:', error)
      this.options.onError?.('Failed to connect to streaming service')
      return false
    }
  }

  // Handle streaming response
  private async handleStreamResponse(response: Response): Promise<boolean> {
    if (!response.body) {
      this.options.onError?.('No response body')
      return false
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      this.isConnected = true
      this.options.onConnectionChange?.(true)

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        this.processStreamChunk(chunk)
      }

      this.isConnected = false
      this.options.onConnectionChange?.(false)
      return true

    } catch (error) {
      console.error('Stream reading error:', error)
      this.isConnected = false
      this.options.onConnectionChange?.(false)

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection(response.url)
      } else {
        this.options.onError?.('Connection lost and reconnection failed')
      }

      return false
    } finally {
      reader.releaseLock()
    }
  }

  // Process individual stream chunks
  private processStreamChunk(chunk: string) {
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const jsonData = line.substring(6) // Remove 'data: ' prefix
          if (jsonData.trim() === '') continue

          const message: StreamingMessage = JSON.parse(jsonData)
          this.handleStreamingMessage(message)
        } catch (parseError) {
          console.error('Failed to parse streaming message:', parseError)
        }
      }
    }
  }

  // Handle individual streaming messages
  private handleStreamingMessage(message: StreamingMessage) {
    switch (message.type) {
      case 'status':
        this.options.onStatus?.(message.data.status, message.data)
        break

      case 'content':
        this.options.onContent?.(
          message.data.content,
          message.data.fullContent,
          message.data
        )
        break

      case 'progress':
        this.options.onProgress?.(
          message.data.progress,
          message.data.stage,
          message.data
        )
        break

      case 'completed':
        this.options.onCompleted?.(message.data)
        break

      case 'error':
        this.options.onError?.(message.data.error, message.data)
        break

      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  // Attempt to reconnect after connection loss
  private async attemptReconnection(url: string) {
    this.reconnectAttempts++

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay))

    try {
      const response = await fetch(url)
      if (response.ok) {
        this.reconnectAttempts = 0
        this.handleStreamResponse(response)
      } else {
        throw new Error(`Reconnection failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error)

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectDelay *= 2 // Exponential backoff
        this.attemptReconnection(url)
      } else {
        this.options.onError?.('Failed to reconnect after multiple attempts')
      }
    }
  }

  // Stop streaming
  stop() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.isConnected = false
    this.sessionId = null
    this.reconnectAttempts = 0
    this.options.onConnectionChange?.(false)
  }

  // Check if currently streaming
  isStreaming(): boolean {
    return this.isConnected
  }

  // Get current session ID
  getSessionId(): string | null {
    return this.sessionId
  }
}

// React hook for streaming
export function useStreaming(options: StreamingOptions = {}) {
  const clientRef = useRef<StreamingClient | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  // Initialize client
  useEffect(() => {
    clientRef.current = new StreamingClient({
      ...options,
      onConnectionChange: (connected) => {
        setIsConnected(connected)
        options.onConnectionChange?.(connected)
      },
    })

    return () => {
      clientRef.current?.stop()
    }
  }, [])

  const startStreaming = useCallback(
    async (inputId: string, draftType: 'grammar_fix' | 'adaptive_polish', processingOptions?: any) => {
      if (!clientRef.current || isStreaming) {
        return false
      }

      setIsStreaming(true)
      const success = await clientRef.current.startStreaming(inputId, draftType, processingOptions)

      if (!success) {
        setIsStreaming(false)
      }

      return success
    },
    [isStreaming]
  )

  const stopStreaming = useCallback(() => {
    clientRef.current?.stop()
    setIsStreaming(false)
    setIsConnected(false)
  }, [])

  return {
    startStreaming,
    stopStreaming,
    isStreaming,
    isConnected,
    sessionId: clientRef.current?.getSessionId() || null,
  }
}

// Utility functions for streaming UI
export function formatStreamingStatus(status: string): string {
  const statusMessages: Record<string, string> = {
    'initializing': 'Preparing to process...',
    'analyzing': 'Analyzing your text...',
    'processing': 'Enhancing your content...',
    'finalizing': 'Adding finishing touches...',
    'completed': 'Processing complete!',
  }

  return statusMessages[status] || status
}

export function getProgressColor(progress: number): string {
  if (progress < 25) return 'bg-red-500'
  if (progress < 50) return 'bg-yellow-500'
  if (progress < 75) return 'bg-blue-500'
  return 'bg-green-500'
}

export function estimateTimeRemaining(progress: number, startTime: Date): string {
  if (progress <= 0) return 'Calculating...'

  const elapsed = Date.now() - startTime.getTime()
  const estimated = (elapsed / progress) * (100 - progress)

  if (estimated < 1000) return 'Almost done'
  if (estimated < 60000) return `${Math.ceil(estimated / 1000)}s remaining`

  const minutes = Math.ceil(estimated / 60000)
  return `${minutes}m remaining`
}

// Error recovery utilities
export function isRetryableError(error: string): boolean {
  const retryableErrors = [
    'network error',
    'connection lost',
    'timeout',
    'rate limit',
    'server error',
  ]

  return retryableErrors.some(retryable =>
    error.toLowerCase().includes(retryable)
  )
}

export function getErrorRecoveryAction(error: string): string {
  if (error.includes('rate limit')) {
    return 'Please wait a moment and try again'
  }

  if (error.includes('network') || error.includes('connection')) {
    return 'Check your internet connection and retry'
  }

  if (error.includes('timeout')) {
    return 'The request took too long. Try with shorter text'
  }

  if (error.includes('quota') || error.includes('limit')) {
    return 'You have reached your usage limit'
  }

  return 'Please try again or contact support'
}

// Helper imports for React hooks
import { useRef, useState, useEffect, useCallback } from 'react'