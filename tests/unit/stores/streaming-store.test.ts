import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreamingStore, useStreamingActions } from '@/lib/stores/streaming-store'
import { streamingFixtures } from '@/tests/fixtures/streaming-data'

// Reset store before each test
beforeEach(() => {
  useStreamingStore.setState({
    sessions: new Map(),
    isConnected: false,
    sessionCount: 0,
    maxSessions: 3
  })
})

describe('StreamingStore', () => {
  describe('session management', () => {
    it('creates new session successfully', () => {
      const { result } = renderHook(() => useStreamingActions())

      act(() => {
        result.current.createSession('input-1', 'grammar_fix')
      })

      const sessions = useStreamingStore.getState().sessions
      expect(sessions.size).toBe(1)

      const session = Array.from(sessions.values())[0]
      expect(session.inputId).toBe('input-1')
      expect(session.draftType).toBe('grammar_fix')
      expect(session.status).toBe('idle')
    })

    it('limits maximum concurrent sessions', () => {
      const { result } = renderHook(() => useStreamingActions())

      // Create 3 sessions (at limit)
      act(() => {
        result.current.createSession('input-1', 'grammar_fix')
        result.current.createSession('input-2', 'adaptive_polish')
        result.current.createSession('input-3', 'grammar_fix')
      })

      expect(useStreamingStore.getState().sessions.size).toBe(3)

      // Try to create 4th session - should fail
      act(() => {
        const sessionId = result.current.createSession('input-4', 'grammar_fix')
        expect(sessionId).toBeUndefined()
      })

      expect(useStreamingStore.getState().sessions.size).toBe(3)
    })

    it('updates session progress correctly', () => {
      const { result } = renderHook(() => useStreamingActions())

      let sessionId: string | undefined

      act(() => {
        sessionId = result.current.createSession('input-1', 'grammar_fix')
      })

      expect(sessionId).toBeDefined()

      act(() => {
        result.current.updateSessionContent(sessionId!, {
          content: 'Hello, could you',
          progress: 25,
          stage: 'Processing...'
        })
      })

      const session = useStreamingStore.getState().sessions.get(sessionId!)
      expect(session?.content).toBe('Hello, could you')
      expect(session?.progress).toBe(25)
      expect(session?.stage).toBe('Processing...')
    })

    it('completes session successfully', () => {
      const { result } = renderHook(() => useStreamingActions())

      let sessionId: string | undefined

      act(() => {
        sessionId = result.current.createSession('input-1', 'grammar_fix')
      })

      act(() => {
        result.current.updateSessionContent(sessionId!, {
          content: streamingFixtures.streamingSessions.grammar.content,
          progress: 100,
          stage: 'completed'
        })
        result.current.completeSession(sessionId!)
      })

      const session = useStreamingStore.getState().sessions.get(sessionId!)
      expect(session?.status).toBe('completed')
      expect(session?.progress).toBe(100)
    })

    it('clears individual session', () => {
      const { result } = renderHook(() => useStreamingActions())

      let sessionId: string | undefined

      act(() => {
        sessionId = result.current.createSession('input-1', 'grammar_fix')
      })

      expect(useStreamingStore.getState().sessions.size).toBe(1)

      act(() => {
        result.current.clearSession(sessionId!)
      })

      expect(useStreamingStore.getState().sessions.size).toBe(0)
    })

    it('clears all sessions', () => {
      const { result } = renderHook(() => useStreamingActions())

      act(() => {
        result.current.createSession('input-1', 'grammar_fix')
        result.current.createSession('input-2', 'adaptive_polish')
      })

      expect(useStreamingStore.getState().sessions.size).toBe(2)

      act(() => {
        result.current.clearAllSessions()
      })

      expect(useStreamingStore.getState().sessions.size).toBe(0)
    })
  })

  describe('connection state', () => {
    it('tracks connection status', () => {
      const { result } = renderHook(() => useStreamingActions())

      expect(useStreamingStore.getState().isConnected).toBe(false)

      act(() => {
        result.current.setConnected(true)
      })

      expect(useStreamingStore.getState().isConnected).toBe(true)

      act(() => {
        result.current.setConnected(false)
      })

      expect(useStreamingStore.getState().isConnected).toBe(false)
    })

    it('updates session count automatically', () => {
      const { result } = renderHook(() => useStreamingActions())

      expect(useStreamingStore.getState().sessionCount).toBe(0)

      act(() => {
        result.current.createSession('input-1', 'grammar_fix')
      })

      expect(useStreamingStore.getState().sessionCount).toBe(1)

      act(() => {
        result.current.createSession('input-2', 'adaptive_polish')
      })

      expect(useStreamingStore.getState().sessionCount).toBe(2)

      act(() => {
        result.current.clearAllSessions()
      })

      expect(useStreamingStore.getState().sessionCount).toBe(0)
    })
  })

  describe('error handling', () => {
    it('handles session not found gracefully', () => {
      const { result } = renderHook(() => useStreamingActions())

      // Try to update non-existent session
      act(() => {
        result.current.updateSessionContent('non-existent', {
          content: 'test',
          progress: 50
        })
      })

      // Should not throw or create invalid state
      expect(useStreamingStore.getState().sessions.size).toBe(0)
    })

    it('handles duplicate session IDs', () => {
      const { result } = renderHook(() => useStreamingActions())

      let sessionId1: string | undefined
      let sessionId2: string | undefined

      act(() => {
        sessionId1 = result.current.createSession('input-1', 'grammar_fix')
        sessionId2 = result.current.createSession('input-1', 'grammar_fix')
      })

      // Should create different session IDs even for same input
      expect(sessionId1).toBeDefined()
      expect(sessionId2).toBeDefined()
      expect(sessionId1).not.toBe(sessionId2)
    })
  })

  describe('selectors', () => {
    it('gets active sessions correctly', () => {
      const { result } = renderHook(() => {
        const actions = useStreamingActions()
        const sessions = useStreamingStore(state =>
          Array.from(state.sessions.values()).filter(s =>
            s.status === 'streaming' || s.status === 'connecting'
          )
        )
        return { actions, activeSessions: sessions }
      })

      let sessionId: string | undefined

      act(() => {
        sessionId = result.current.actions.createSession('input-1', 'grammar_fix')
        result.current.actions.updateSessionContent(sessionId!, {
          content: 'test',
          progress: 25,
          stage: 'streaming'
        })
        // Set status to streaming
        useStreamingStore.setState(state => {
          const session = state.sessions.get(sessionId!)
          if (session) {
            session.status = 'streaming'
          }
          return state
        })
      })

      expect(result.current.activeSessions).toHaveLength(1)
      expect(result.current.activeSessions[0].status).toBe('streaming')
    })
  })
})