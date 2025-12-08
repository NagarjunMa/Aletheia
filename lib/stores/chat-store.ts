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
  category: 'email' | 'letter' | 'proposal' | 'memo' | 'general'
  created_at: string
  updated_at: string
  last_activity_at: string
}

export interface Draft {
  id: string
  content: string
  type: 'grammar_fix' | 'adaptive_polish'
  cpl_score: number
  is_accepted: boolean | null
  created_at: string
  user_input_id: string
}

interface ChatState {
  // Current conversation
  currentConversation: Conversation | null
  messages: Message[]

  // Drafts
  currentDrafts: Draft[]
  isGeneratingDrafts: boolean

  // UI state
  isLoading: boolean
  streamingContent: string
  isStreaming: boolean

  // Input state
  inputText: string
  selectedCategory: Conversation['category']
}

interface ChatActions {
  // Conversation management
  setCurrentConversation: (conversation: Conversation | null) => void
  createNewConversation: (title: string, category: Conversation['category']) => Promise<Conversation>

  // Message management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void

  // Draft generation
  generateDrafts: (input: string) => Promise<void>
  acceptDraft: (draftId: string, userEdits?: string) => Promise<void>
  rejectDraft: (draftId: string) => Promise<void>

  // Streaming
  setStreamingContent: (content: string) => void
  startStreaming: () => void
  stopStreaming: () => void

  // Input management
  setInputText: (text: string) => void
  setSelectedCategory: (category: Conversation['category']) => void
  clearInput: () => void

  // UI state
  setLoading: (loading: boolean) => void
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  // Initial state
  currentConversation: null,
  messages: [],
  currentDrafts: [],
  isGeneratingDrafts: false,
  isLoading: false,
  streamingContent: '',
  isStreaming: false,
  inputText: '',
  selectedCategory: 'general',

  // Conversation actions
  setCurrentConversation: (conversation) => {
    set({
      currentConversation: conversation,
      messages: [],
      currentDrafts: []
    })
  },

  createNewConversation: async (title, category) => {
    const supabase = createClient()

    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          title,
          category,
          last_activity_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      set({ currentConversation: conversation })
      return conversation
    } catch (error) {
      console.error('Failed to create conversation:', error)
      throw error
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
      messages: [...state.messages, newMessage]
    }))
  },

  clearMessages: () => set({ messages: [] }),

  // Draft generation
  generateDrafts: async (input) => {
    const { currentConversation, selectedCategory } = get()

    set({ isGeneratingDrafts: true, currentDrafts: [] })

    try {
      // Create conversation if it doesn't exist
      let conversation = currentConversation
      if (!conversation) {
        const title = input.substring(0, 50) + (input.length > 50 ? '...' : '')
        conversation = await get().createNewConversation(title, selectedCategory)
      }

      // Add user message
      get().addMessage({
        role: 'user',
        content: input
      })

      // Call the draft generation API
      const response = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          conversationId: conversation.id,
          category: selectedCategory
        })
      })

      if (!response.ok) throw new Error('Failed to generate drafts')

      const { drafts } = await response.json()
      set({ currentDrafts: drafts })

      // Add assistant message with drafts
      get().addMessage({
        role: 'assistant',
        content: 'I\'ve generated two versions for you - a grammar fix and an adaptive polish that matches your writing style.'
      })

    } catch (error) {
      console.error('Failed to generate drafts:', error)
      get().addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error while generating your drafts. Please try again.'
      })
    } finally {
      set({ isGeneratingDrafts: false })
    }
  },

  acceptDraft: async (draftId, userEdits) => {
    try {
      const response = await fetch('/api/drafts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          accepted: true,
          userEdits
        })
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      // Update draft in local state
      set((state) => ({
        currentDrafts: state.currentDrafts.map(draft =>
          draft.id === draftId
            ? { ...draft, is_accepted: true }
            : draft
        )
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
          draftId,
          accepted: false
        })
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      // Update draft in local state
      set((state) => ({
        currentDrafts: state.currentDrafts.map(draft =>
          draft.id === draftId
            ? { ...draft, is_accepted: false }
            : draft
        )
      }))

    } catch (error) {
      console.error('Failed to reject draft:', error)
      throw error
    }
  },

  // Streaming actions
  setStreamingContent: (streamingContent) => set({ streamingContent }),
  startStreaming: () => set({ isStreaming: true, streamingContent: '' }),
  stopStreaming: () => set({ isStreaming: false, streamingContent: '' }),

  // Input actions
  setInputText: (inputText) => set({ inputText }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  clearInput: () => set({ inputText: '' }),

  // UI actions
  setLoading: (isLoading) => set({ isLoading }),
}))