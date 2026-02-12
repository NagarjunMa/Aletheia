import { createClient } from '@/lib/supabase/client'

export interface StreamingDraftChunk {
  id: string
  conversationId: string
  draftType: 'grammar_fix' | 'adaptive_polish'
  content: string
  isComplete: boolean
  progress: number
  cplScore?: number
  timestamp: Date
}

export interface StreamingSession {
  id: string
  userId: string
  conversationId: string
  status: 'pending' | 'streaming' | 'completed' | 'error'
  startTime: Date
  endTime?: Date
  totalChunks: number
  completedChunks: number
}

export class StreamingManager {
  private ws: WebSocket | null = null
  private sessions = new Map<string, StreamingSession>()
  private subscribers = new Map<string, Set<(chunk: StreamingDraftChunk) => void>>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(private userId: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // In a production environment, this would be your WebSocket server
        // For now, we'll simulate WebSocket behavior with EventSource (Server-Sent Events)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/stream/websocket?userId=${this.userId}`

        // For development, we'll use a mock WebSocket that simulates streaming
        this.simulateWebSocketConnection()
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  private simulateWebSocketConnection() {
    // Simulate WebSocket connection for development
    this.ws = {
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    } as any

    console.log('Simulated WebSocket connection established')
  }

  async startStreamingDraft(conversationId: string, prompt: string, category: string): Promise<string> {
    const sessionId = crypto.randomUUID()

    const session: StreamingSession = {
      id: sessionId,
      userId: this.userId,
      conversationId,
      status: 'pending',
      startTime: new Date(),
      totalChunks: 2, // grammar_fix + adaptive_polish
      completedChunks: 0
    }

    this.sessions.set(sessionId, session)

    // Start streaming via API
    this.streamDrafts(sessionId, prompt, category)

    return sessionId
  }

  private async streamDrafts(sessionId: string, prompt: string, category: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      session.status = 'streaming'

      // Call the streaming API
      const response = await fetch('/api/stream/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          prompt,
          category,
          conversationId: session.conversationId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start streaming')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let currentDraftId = ''
      let currentDraftType: 'grammar_fix' | 'adaptive_polish' = 'grammar_fix'
      let currentContent = ''
      let progress = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'draft_start') {
                currentDraftId = data.draftId
                currentDraftType = data.draftType
                currentContent = ''
                progress = 0
              } else if (data.type === 'draft_chunk') {
                currentContent += data.content
                progress = data.progress || 0

                const chunk: StreamingDraftChunk = {
                  id: currentDraftId,
                  conversationId: session.conversationId,
                  draftType: currentDraftType,
                  content: currentContent,
                  isComplete: false,
                  progress,
                  timestamp: new Date()
                }

                this.notifySubscribers(sessionId, chunk)
              } else if (data.type === 'draft_complete') {
                const finalChunk: StreamingDraftChunk = {
                  id: currentDraftId,
                  conversationId: session.conversationId,
                  draftType: currentDraftType,
                  content: currentContent,
                  isComplete: true,
                  progress: 100,
                  cplScore: data.cplScore,
                  timestamp: new Date()
                }

                this.notifySubscribers(sessionId, finalChunk)
                session.completedChunks++

                // Switch to adaptive polish if we just completed grammar fix
                if (currentDraftType === 'grammar_fix') {
                  currentDraftType = 'adaptive_polish'
                }
              } else if (data.type === 'session_complete') {
                session.status = 'completed'
                session.endTime = new Date()
                break
              } else if (data.type === 'error') {
                session.status = 'error'
                console.error('Streaming error:', data.message)
                break
              }
            }
          } catch (parseError) {
            console.error('Failed to parse streaming data:', parseError)
          }
        }
      }
    } catch (error) {
      session.status = 'error'
      console.error('Streaming failed:', error)
    }
  }

  subscribe(sessionId: string, callback: (chunk: StreamingDraftChunk) => void): () => void {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set())
    }

    this.subscribers.get(sessionId)!.add(callback)

    // Return unsubscribe function
    return () => {
      const sessionSubscribers = this.subscribers.get(sessionId)
      if (sessionSubscribers) {
        sessionSubscribers.delete(callback)
        if (sessionSubscribers.size === 0) {
          this.subscribers.delete(sessionId)
        }
      }
    }
  }

  private notifySubscribers(sessionId: string, chunk: StreamingDraftChunk) {
    const sessionSubscribers = this.subscribers.get(sessionId)
    if (sessionSubscribers) {
      sessionSubscribers.forEach(callback => {
        try {
          callback(chunk)
        } catch (error) {
          console.error('Error in streaming callback:', error)
        }
      })
    }
  }

  getSession(sessionId: string): StreamingSession | undefined {
    return this.sessions.get(sessionId)
  }

  cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session && session.status === 'streaming') {
      session.status = 'error'
      session.endTime = new Date()
      this.subscribers.delete(sessionId)
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.sessions.clear()
    this.subscribers.clear()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// React hook for streaming
export function useStreamingDrafts(userId: string) {
  const [manager, setManager] = React.useState<StreamingManager | null>(null)
  const [isConnected, setIsConnected] = React.useState(false)

  React.useEffect(() => {
    const streamingManager = new StreamingManager(userId)

    streamingManager.connect()
      .then(() => {
        setIsConnected(true)
        setManager(streamingManager)
      })
      .catch(error => {
        console.error('Failed to connect streaming manager:', error)
        setIsConnected(false)
      })

    return () => {
      streamingManager.disconnect()
      setIsConnected(false)
    }
  }, [userId])

  const startStreaming = React.useCallback(async (
    conversationId: string,
    prompt: string,
    category: string
  ): Promise<string | null> => {
    if (!manager) return null

    try {
      return await manager.startStreamingDraft(conversationId, prompt, category)
    } catch (error) {
      console.error('Failed to start streaming:', error)
      return null
    }
  }, [manager])

  const subscribeToSession = React.useCallback((
    sessionId: string,
    callback: (chunk: StreamingDraftChunk) => void
  ): (() => void) | null => {
    if (!manager) return null
    return manager.subscribe(sessionId, callback)
  }, [manager])

  const cancelSession = React.useCallback((sessionId: string) => {
    if (manager) {
      manager.cancelSession(sessionId)
    }
  }, [manager])

  const getSession = React.useCallback((sessionId: string): StreamingSession | undefined => {
    return manager?.getSession(sessionId)
  }, [manager])

  return {
    isConnected,
    startStreaming,
    subscribeToSession,
    cancelSession,
    getSession
  }
}

// Add React import for the hook
declare global {
  const React: any
}