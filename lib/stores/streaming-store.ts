// Streaming State Store
// Created: December 8, 2024
// Purpose: Manage real-time streaming processing state

import { create } from 'zustand'

interface StreamingSession {
  id: string
  inputId: string
  draftType: 'grammar_fix' | 'adaptive_polish'
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error'
  progress: number
  stage: string
  content: string
  fullContent: string
  error?: string
  startedAt: Date
  completedAt?: Date
  cplScore?: number
}

interface StreamingState {
  // Active sessions
  sessions: Map<string, StreamingSession>
  activeSessionId?: string

  // Current session state
  isStreaming: boolean
  isConnected: boolean

  // Global streaming settings
  maxConcurrentSessions: number
  reconnectAttempts: number
}

interface StreamingActions {
  // Session management
  createSession: (inputId: string, draftType: 'grammar_fix' | 'adaptive_polish') => string
  setActiveSession: (sessionId: string) => void
  removeSession: (sessionId: string) => void
  clearSessions: () => void

  // Stream state updates
  updateSessionStatus: (sessionId: string, status: StreamingSession['status']) => void
  updateSessionProgress: (sessionId: string, progress: number, stage?: string) => void
  updateSessionContent: (sessionId: string, content: string, fullContent: string) => void
  completeSession: (sessionId: string, finalContent: string, cplScore?: number) => void
  errorSession: (sessionId: string, error: string) => void

  // Connection state
  setConnected: (connected: boolean) => void
  setStreaming: (streaming: boolean) => void

  // Utilities
  getActiveSession: () => StreamingSession | null
  getSession: (sessionId: string) => StreamingSession | null
  hasActiveSession: () => boolean
  getSessionCount: () => number
}

export const useStreamingStore = create<StreamingState & StreamingActions>((set, get) => ({
  // Initial state
  sessions: new Map(),
  activeSessionId: undefined,
  isStreaming: false,
  isConnected: false,
  maxConcurrentSessions: 3,
  reconnectAttempts: 0,

  // Session management
  createSession: (inputId, draftType) => {
    const sessionId = crypto.randomUUID()
    const session: StreamingSession = {
      id: sessionId,
      inputId,
      draftType,
      status: 'idle',
      progress: 0,
      stage: 'Initializing...',
      content: '',
      fullContent: '',
      startedAt: new Date(),
    }

    set((state) => {
      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, session)

      return {
        sessions: newSessions,
        activeSessionId: sessionId,
      }
    })

    return sessionId
  },

  setActiveSession: (sessionId) =>
    set(() => ({
      activeSessionId: sessionId,
    })),

  removeSession: (sessionId) =>
    set((state) => {
      const newSessions = new Map(state.sessions)
      newSessions.delete(sessionId)

      return {
        sessions: newSessions,
        activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId,
      }
    }),

  clearSessions: () =>
    set(() => ({
      sessions: new Map(),
      activeSessionId: undefined,
      isStreaming: false,
      isConnected: false,
    })),

  // Stream state updates
  updateSessionStatus: (sessionId, status) =>
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state

      const updatedSession = { ...session, status }
      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, updatedSession)

      return {
        sessions: newSessions,
        isStreaming: status === 'streaming' || status === 'connecting',
      }
    }),

  updateSessionProgress: (sessionId, progress, stage) =>
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state

      const updatedSession = {
        ...session,
        progress: Math.min(Math.max(progress, 0), 100),
        ...(stage && { stage }),
      }

      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, updatedSession)

      return { sessions: newSessions }
    }),

  updateSessionContent: (sessionId, content, fullContent) =>
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state

      const updatedSession = {
        ...session,
        content,
        fullContent,
      }

      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, updatedSession)

      return { sessions: newSessions }
    }),

  completeSession: (sessionId, finalContent, cplScore) =>
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state

      const updatedSession = {
        ...session,
        status: 'completed' as const,
        fullContent: finalContent,
        progress: 100,
        stage: 'Completed',
        completedAt: new Date(),
        cplScore,
      }

      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, updatedSession)

      return {
        sessions: newSessions,
        isStreaming: false,
      }
    }),

  errorSession: (sessionId, error) =>
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state

      const updatedSession = {
        ...session,
        status: 'error' as const,
        error,
        completedAt: new Date(),
      }

      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, updatedSession)

      return {
        sessions: newSessions,
        isStreaming: false,
      }
    }),

  // Connection state
  setConnected: (isConnected) =>
    set(() => ({ isConnected })),

  setStreaming: (isStreaming) =>
    set(() => ({ isStreaming })),

  // Utilities
  getActiveSession: () => {
    const state = get()
    return state.activeSessionId ? state.sessions.get(state.activeSessionId) || null : null
  },

  getSession: (sessionId) => {
    const state = get()
    return state.sessions.get(sessionId) || null
  },

  hasActiveSession: () => {
    const state = get()
    return !!state.activeSessionId && state.sessions.has(state.activeSessionId)
  },

  getSessionCount: () => {
    const state = get()
    return state.sessions.size
  },
}))

// Selectors for common use cases
export const useStreamingSession = (sessionId?: string) =>
  useStreamingStore((state) => {
    const id = sessionId || state.activeSessionId
    return id ? state.sessions.get(id) || null : null
  })

export const useActiveStreamingSession = () =>
  useStreamingStore((state) => state.getActiveSession())

export const useStreamingStatus = () =>
  useStreamingStore((state) => ({
    isStreaming: state.isStreaming,
    isConnected: state.isConnected,
    sessionCount: state.sessions.size,
    hasActiveSession: !!state.activeSessionId,
  }))

export const useStreamingActions = () =>
  useStreamingStore((state) => ({
    createSession: state.createSession,
    setActiveSession: state.setActiveSession,
    removeSession: state.removeSession,
    clearSessions: state.clearSessions,
    updateSessionStatus: state.updateSessionStatus,
    updateSessionProgress: state.updateSessionProgress,
    updateSessionContent: state.updateSessionContent,
    completeSession: state.completeSession,
    errorSession: state.errorSession,
    setConnected: state.setConnected,
    setStreaming: state.setStreaming,
  }))