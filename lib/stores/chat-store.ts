import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface Conversation {
  id: string
  title: string
  category: 'instagram_post' | 'linkedin' | 'medium_article' | 'email' | 'conversational'
  created_at: string
  updated_at: string
  last_activity_at: string
}

export interface Draft {
  id: string
  content: string
  draft_type: 'grammar_fix' | 'adaptive_polish'
  cpl_score: number
  is_accepted: boolean | null
  created_at: string
  user_input_id: string
}

interface ChatState {
  // Conversation data
  conversation: {
    current: Conversation | null
    messages: Message[]
    metadata: Record<string, unknown>
  }

  // Draft generation workflow
  draftGeneration: {
    currentDrafts: Draft[]
    isGenerating: boolean
    streamingDrafts: Draft[]
    progress: { grammar: number; polish: number }
  }

  // Streaming state
  streaming: {
    isActive: boolean
    content: string
    controller: AbortController | null
    reader: ReadableStreamDefaultReader<Uint8Array> | null
    connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  }

  // UI state (temporary, non-persistent)
  ui: {
    isLoading: boolean
    inputText: string
    selectedCategory: Conversation['category']
    messagePreview: string | null
    isTyping: boolean
    typingIndicator: string | null
    errors: string[]
  }
}

interface ChatActions {
  // Conversation management
  setCurrentConversation: (conversation: Conversation | null) => void
  createNewConversation: (title: string, category: Conversation['category']) => Promise<Conversation>
  loadConversations: () => Promise<Conversation[]>
  deleteConversation: (conversationId: string) => Promise<void>
  updateConversationActivity: (conversationId: string) => Promise<void>

  // Message management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void

  // Draft generation
  generateDrafts: (input: string) => Promise<void>
  generateDraftsWithStreaming: (input: string) => Promise<void>
  acceptDraft: (draftId: string, userEdits?: string) => Promise<void>
  rejectDraft: (draftId: string) => Promise<void>

  // SSE Streaming
  startStreamingConnection: (input: string) => Promise<void>
  stopStreamingConnection: () => void
  handleStreamingChunk: (chunk: any) => void
  reconnectStream: () => Promise<void>

  // Input management
  setInputText: (text: string) => void
  setSelectedCategory: (category: Conversation['category']) => void
  clearInput: () => void
  clearAllUIState: () => void

  // UI state
  setLoading: (loading: boolean) => void
  addError: (error: string) => void
  clearErrors: () => void

  // Typing indicators (proper implementation)
  setTypingIndicator: (indicator: string | null) => void
  startTyping: () => void
  stopTyping: () => void
  updateMessagePreview: (content: string) => void
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  // Initial state with proper separation
  conversation: {
    current: null,
    messages: [],
    metadata: {}
  },

  draftGeneration: {
    currentDrafts: [],
    isGenerating: false,
    streamingDrafts: [],
    progress: { grammar: 0, polish: 0 }
  },

  streaming: {
    isActive: false,
    content: '',
    controller: null,
    reader: null,
    connectionStatus: 'disconnected'
  },

  ui: {
    isLoading: false,
    inputText: '',
    selectedCategory: 'conversational',
    messagePreview: null,
    isTyping: false,
    typingIndicator: null,
    errors: []
  },

  // Conversation actions
  setCurrentConversation: (conversation) => {
    set({
      conversation: {
        current: conversation,
        messages: [],
        metadata: {}
      },
      draftGeneration: {
        currentDrafts: [],
        isGenerating: false,
        streamingDrafts: [],
        progress: { grammar: 0, polish: 0 }
      }
    })
  },

  createNewConversation: async (title, category) => {
    const supabase = createClient()

    // Get current user - CRITICAL for fixing schema issue
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id, // CRITICAL FIX: This was missing!
          title,
          category,
          last_activity_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        conversation: {
          ...state.conversation,
          current: conversation
        }
      }))
      return conversation
    } catch (error) {
      console.error('Failed to create conversation:', error)
      throw error
    }
  },

  loadConversations: async () => {
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_activity_at', { ascending: false })

      if (error) throw error
      return conversations || []
    } catch (error) {
      console.error('Failed to load conversations:', error)
      throw error
    }
  },

  deleteConversation: async (conversationId: string) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error

      // If deleting current conversation, clear it
      const { conversation } = get()
      if (conversation.current?.id === conversationId) {
        set({
          conversation: {
            current: null,
            messages: [],
            metadata: {}
          }
        })
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      throw error
    }
  },

  updateConversationActivity: async (conversationId: string) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', conversationId)

      if (error) throw error
    } catch (error) {
      console.error('Failed to update conversation activity:', error)
      // Don't throw here as this is not critical
    }
  },

  // Message actions
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }

    set((state) => ({
      conversation: {
        ...state.conversation,
        messages: [...state.conversation.messages, newMessage]
      }
    }))
  },

  clearMessages: () => set((state) => ({
    conversation: {
      ...state.conversation,
      messages: []
    }
  })),

  // Draft generation (non-streaming fallback)
  generateDrafts: async (input) => {
    const { conversation, ui } = get()
    const selectedCategory = ui.selectedCategory

    set((state) => ({
      draftGeneration: {
        ...state.draftGeneration,
        isGenerating: true,
        currentDrafts: []
      },
      ui: { ...state.ui, errors: [] }
    }))

    try {
      // Create conversation if it doesn't exist
      let currentConversation = conversation.current
      if (!currentConversation) {
        const title = input.substring(0, 50) + (input.length > 50 ? '...' : '')
        currentConversation = await get().createNewConversation(title, selectedCategory)
      }

      // Add user message immediately
      get().addMessage({
        role: 'user',
        content: input
      })

      // Clear UI state
      get().clearAllUIState()

      // Call the draft generation API
      const response = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          conversation_id: currentConversation.id,
          category: selectedCategory
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const { drafts } = await response.json()
      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          currentDrafts: drafts
        }
      }))

      // Add assistant message with drafts
      get().addMessage({
        role: 'assistant',
        content: 'I\'ve generated two versions for you - a grammar fix and an adaptive polish that matches your writing style.'
      })

    } catch (error) {
      console.error('Failed to generate drafts:', error)
      get().addError(error instanceof Error ? error.message : 'Unknown error occurred')
      get().addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error while generating your drafts. Please try again.'
      })
    } finally {
      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          isGenerating: false
        }
      }))
    }
  },

  // SSE Streaming implementation
  generateDraftsWithStreaming: async (input) => {
    try {
      await get().startStreamingConnection(input)
    } catch (error) {
      console.error('Streaming failed, falling back to non-streaming:', error)
      await get().generateDrafts(input)
    }
  },

  acceptDraft: async (draftId, userEdits) => {
    try {
      const response = await fetch('/api/drafts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draftId,
          is_accepted: true,
          user_edits: userEdits
        })
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      // Update draft in local state
      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          currentDrafts: state.draftGeneration.currentDrafts.map(draft =>
            draft.id === draftId
              ? { ...draft, is_accepted: true }
              : draft
          )
        }
      }))

    } catch (error) {
      console.error('Failed to accept draft:', error)
      throw error
    }
  },

  rejectDraft: async (draftId) => {
    try {
      const response = await fetch('/api/drafts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draftId,
          is_accepted: false
        })
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      // Update draft in local state
      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          currentDrafts: state.draftGeneration.currentDrafts.map(draft =>
            draft.id === draftId
              ? { ...draft, is_accepted: false }
              : draft
          )
        }
      }))

    } catch (error) {
      console.error('Failed to reject draft:', error)
      throw error
    }
  },

  // SSE Streaming actions
  startStreamingConnection: async (input: string) => {
    const { conversation, ui } = get()

    try {
      // Ensure we have a conversation
      let currentConversation = conversation.current
      if (!currentConversation) {
        const title = input.substring(0, 50) + (input.length > 50 ? '...' : '')
        currentConversation = await get().createNewConversation(title, ui.selectedCategory)
      }

      // Add user message immediately
      get().addMessage({ role: 'user', content: input })
      get().clearAllUIState()

      // Set up streaming state
      set((state) => ({
        streaming: {
          ...state.streaming,
          isActive: true,
          connectionStatus: 'connecting',
          content: ''
        },
        draftGeneration: {
          ...state.draftGeneration,
          isGenerating: true,
          streamingDrafts: [],
          progress: { grammar: 0, polish: 0 }
        }
      }))

      // Create fetch-based streaming connection with POST
      const controller = new AbortController()

      const response = await fetch('/api/stream/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input,
          conversationId: currentConversation.id,
          category: ui.selectedCategory
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response stream reader')
      }

      set((state) => ({
        streaming: {
          ...state.streaming,
          controller,
          reader,
          connectionStatus: 'connected'
        }
      }))

      // Process stream chunks
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6))
                get().handleStreamingChunk(data)
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError)
              }
            }
          }
        }
      } catch (streamError) {
        if (streamError instanceof Error && streamError.name !== 'AbortError') {
          console.error('Stream processing error:', streamError)
          set((state) => ({
            streaming: {
              ...state.streaming,
              connectionStatus: 'error'
            }
          }))
          get().stopStreamingConnection()
        }
      }

    } catch (error) {
      console.error('Failed to start streaming:', error)
      get().addError('Failed to start streaming connection')
      throw error
    }
  },

  stopStreamingConnection: () => {
    const { streaming } = get()

    // Safely abort controller - may already be aborted or in invalid state
    if (streaming.controller) {
      try {
        streaming.controller.abort()
      } catch (error) {
        // Silently ignore abort errors - stream may already be closed
        console.debug('Controller abort handled:', error)
      }
    }

    // Safely cancel reader - may already be cancelled or closed
    if (streaming.reader) {
      try {
        streaming.reader.cancel().catch(() => {
          // Ignore cancellation errors
        })
      } catch (error) {
        // Silently ignore cancel errors - reader may already be closed
        console.debug('Reader cancel handled:', error)
      }
    }

    set((state) => ({
      streaming: {
        ...state.streaming,
        isActive: false,
        controller: null,
        reader: null,
        connectionStatus: 'disconnected'
      },
      draftGeneration: {
        ...state.draftGeneration,
        isGenerating: false
      }
    }))
  },

  handleStreamingChunk: (chunk: any) => {
    console.log('[Chat Store] Received chunk:', chunk.type, chunk)

    if (chunk.type === 'draft_chunk') {
      // Store token for buffering (components will handle buffering)
      set((state) => {
        // Create a minimal state update - token buffering happens in components
        const streamingUpdate = {
          lastTokenReceived: {
            draft_type: chunk.draft_type,
            content: chunk.content,
            timestamp: Date.now()
          }
        }

        return {
          draftGeneration: {
            ...state.draftGeneration,
            ...streamingUpdate
          }
        }
      })

      // Notify components about new token (they handle buffering)
      const event = new CustomEvent('streamingToken', {
        detail: {
          draftType: chunk.draft_type,
          token: chunk.content
        }
      })
      window.dispatchEvent(event)

    } else if (chunk.type === 'progress') {
      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          progress: chunk.progress || { grammar: 0, polish: 0 }
        }
      }))
    } else if (chunk.type === 'draft_complete') {
      // Individual draft completed with CPL score
      console.log('[Chat Store] Draft complete with CPL score:', chunk.cplScore)
    } else if (chunk.type === 'complete' || chunk.type === 'session_complete') {
      // Handle both old 'complete' and new 'session_complete' event types
      console.log('[Chat Store] Stream complete with drafts:', chunk.drafts)

      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          currentDrafts: chunk.drafts || [],
          streamingDrafts: [],
          isGenerating: false
        }
      }))

      get().addMessage({
        role: 'assistant',
        content: 'I\'ve generated two versions for you - a grammar fix and an adaptive polish that matches your writing style.'
      })

      // Notify components that streaming is complete
      const event = new CustomEvent('streamingComplete', {
        detail: { drafts: chunk.drafts }
      })
      window.dispatchEvent(event)

      get().stopStreamingConnection()
    } else if (chunk.type === 'error') {
      console.error('[Chat Store] Stream error:', chunk.message)

      set((state) => ({
        draftGeneration: {
          ...state.draftGeneration,
          isGenerating: false
        },
        ui: {
          ...state.ui,
          errors: [...state.ui.errors, chunk.message]
        }
      }))

      get().stopStreamingConnection()
    }
  },

  reconnectStream: async () => {
    // Implement reconnection logic with exponential backoff
    const { ui } = get()
    if (ui.inputText.trim()) {
      await get().startStreamingConnection(ui.inputText)
    }
  },

  // Input management with proper state clearing
  setInputText: (inputText) => set((state) => ({
    ui: { ...state.ui, inputText }
  })),

  setSelectedCategory: (selectedCategory) => set((state) => ({
    ui: { ...state.ui, selectedCategory }
  })),

  clearInput: () => set((state) => ({
    ui: {
      ...state.ui,
      inputText: '',
      messagePreview: null,
      isTyping: false,
      typingIndicator: null
    }
  })),

  clearAllUIState: () => set((state) => ({
    ui: {
      ...state.ui,
      messagePreview: null,
      isTyping: false,
      typingIndicator: null,
      errors: []
    }
  })),

  // UI actions
  setLoading: (isLoading) => set((state) => ({
    ui: { ...state.ui, isLoading }
  })),

  addError: (error: string) => set((state) => ({
    ui: {
      ...state.ui,
      errors: [...state.ui.errors, error]
    }
  })),

  clearErrors: () => set((state) => ({
    ui: { ...state.ui, errors: [] }
  })),

  // Proper typing indicators (without auto-timeout)
  setTypingIndicator: (indicator) => set((state) => ({
    ui: { ...state.ui, typingIndicator: indicator }
  })),

  startTyping: () => set((state) => ({
    ui: {
      ...state.ui,
      isTyping: true,
      typingIndicator: 'Typing...'
    }
  })),

  stopTyping: () => set((state) => ({
    ui: {
      ...state.ui,
      isTyping: false,
      typingIndicator: null,
      messagePreview: null
    }
  })),

  updateMessagePreview: (content: string) => {
    if (content.trim().length > 0) {
      set((state) => ({
        ui: {
          ...state.ui,
          messagePreview: content,
          isTyping: true
        }
      }))
    } else {
      set((state) => ({
        ui: {
          ...state.ui,
          messagePreview: null,
          isTyping: false
        }
      }))
    }
  },
}))