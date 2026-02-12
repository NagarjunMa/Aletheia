// Content Store
// Created: December 8, 2024
// Purpose: Manage conversations, inputs, and drafts state

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Conversation {
  id: string
  title: string
  description?: string
  category?: string
  user_id: string
  created_at: string
  updated_at: string
  input_count: number
  latest_input_at?: string
}

interface UserInput {
  id: string
  conversation_id: string
  input_text: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_preferences?: {
    grammar_only?: boolean
    preserve_style?: boolean
    target_cpl?: number
  }
  created_at: string
  updated_at: string
  draft_count: number
}

interface Draft {
  id: string
  input_id: string
  user_id: string
  draft_type: 'grammar_fix' | 'adaptive_polish'
  content: string
  cpl_score?: number
  user_rating?: number
  generation_status: 'processing' | 'completed' | 'failed'
  processing_options?: Record<string, any>
  created_at: string
  updated_at: string
}

interface ContentState {
  // Current context
  currentConversationId?: string
  currentInputId?: string
  currentDraftId?: string

  // Data
  conversations: Map<string, Conversation>
  inputs: Map<string, UserInput>
  drafts: Map<string, Draft>

  // UI state
  isLoading: boolean
  selectedDraftType: 'grammar_fix' | 'adaptive_polish'

  // Filters and sorting
  conversationFilter: string
  sortBy: 'created_at' | 'updated_at' | 'title'
  sortOrder: 'asc' | 'desc'
}

interface ContentActions {
  // Conversation management
  setCurrentConversation: (conversationId: string) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void
  removeConversation: (conversationId: string) => void
  getConversation: (conversationId: string) => Conversation | null

  // Input management
  setCurrentInput: (inputId: string) => void
  addInput: (input: UserInput) => void
  updateInput: (inputId: string, updates: Partial<UserInput>) => void
  removeInput: (inputId: string) => void
  getInput: (inputId: string) => UserInput | null
  getInputsForConversation: (conversationId: string) => UserInput[]

  // Draft management
  setCurrentDraft: (draftId: string) => void
  addDraft: (draft: Draft) => void
  updateDraft: (draftId: string, updates: Partial<Draft>) => void
  removeDraft: (draftId: string) => void
  getDraft: (draftId: string) => Draft | null
  getDraftsForInput: (inputId: string) => Draft[]

  // UI state
  setLoading: (loading: boolean) => void
  setSelectedDraftType: (type: 'grammar_fix' | 'adaptive_polish') => void
  setConversationFilter: (filter: string) => void
  setSorting: (sortBy: ContentState['sortBy'], sortOrder: ContentState['sortOrder']) => void

  // Bulk operations
  loadConversations: (conversations: Conversation[]) => void
  loadInputs: (inputs: UserInput[]) => void
  loadDrafts: (drafts: Draft[]) => void
  clearAll: () => void

  // Analytics
  getConversationStats: () => {
    totalConversations: number
    totalInputs: number
    totalDrafts: number
    averageCPL: number
  }
}

export const useContentStore = create<ContentState & ContentActions>()(
  persist(
    (set, get) => ({
      // Initial state
      currentConversationId: undefined,
      currentInputId: undefined,
      currentDraftId: undefined,
      conversations: new Map(),
      inputs: new Map(),
      drafts: new Map(),
      isLoading: false,
      selectedDraftType: 'adaptive_polish',
      conversationFilter: '',
      sortBy: 'updated_at',
      sortOrder: 'desc',

      // Conversation management
      setCurrentConversation: (conversationId) =>
        set(() => ({ currentConversationId: conversationId })),

      addConversation: (conversation) =>
        set((state) => {
          const newConversations = new Map(state.conversations)
          newConversations.set(conversation.id, conversation)
          return { conversations: newConversations }
        }),

      updateConversation: (conversationId, updates) =>
        set((state) => {
          const conversation = state.conversations.get(conversationId)
          if (!conversation) return state

          const updatedConversation = {
            ...conversation,
            ...updates,
            updated_at: new Date().toISOString(),
          }

          const newConversations = new Map(state.conversations)
          newConversations.set(conversationId, updatedConversation)
          return { conversations: newConversations }
        }),

      removeConversation: (conversationId) =>
        set((state) => {
          const newConversations = new Map(state.conversations)
          newConversations.delete(conversationId)

          // Also remove related inputs and drafts
          const newInputs = new Map(state.inputs)
          const newDrafts = new Map(state.drafts)

          // Remove inputs for this conversation
          for (const [inputId, input] of state.inputs) {
            if (input.conversation_id === conversationId) {
              newInputs.delete(inputId)

              // Remove drafts for this input
              for (const [draftId, draft] of state.drafts) {
                if (draft.input_id === inputId) {
                  newDrafts.delete(draftId)
                }
              }
            }
          }

          return {
            conversations: newConversations,
            inputs: newInputs,
            drafts: newDrafts,
            currentConversationId:
              state.currentConversationId === conversationId
                ? undefined
                : state.currentConversationId,
          }
        }),

      getConversation: (conversationId) => {
        const state = get()
        return state.conversations.get(conversationId) || null
      },

      // Input management
      setCurrentInput: (inputId) =>
        set(() => ({ currentInputId: inputId })),

      addInput: (input) =>
        set((state) => {
          const newInputs = new Map(state.inputs)
          newInputs.set(input.id, input)
          return { inputs: newInputs }
        }),

      updateInput: (inputId, updates) =>
        set((state) => {
          const input = state.inputs.get(inputId)
          if (!input) return state

          const updatedInput = {
            ...input,
            ...updates,
            updated_at: new Date().toISOString(),
          }

          const newInputs = new Map(state.inputs)
          newInputs.set(inputId, updatedInput)
          return { inputs: newInputs }
        }),

      removeInput: (inputId) =>
        set((state) => {
          const newInputs = new Map(state.inputs)
          newInputs.delete(inputId)

          // Also remove related drafts
          const newDrafts = new Map(state.drafts)
          for (const [draftId, draft] of state.drafts) {
            if (draft.input_id === inputId) {
              newDrafts.delete(draftId)
            }
          }

          return {
            inputs: newInputs,
            drafts: newDrafts,
            currentInputId: state.currentInputId === inputId ? undefined : state.currentInputId,
          }
        }),

      getInput: (inputId) => {
        const state = get()
        return state.inputs.get(inputId) || null
      },

      getInputsForConversation: (conversationId) => {
        const state = get()
        return Array.from(state.inputs.values()).filter(
          (input) => input.conversation_id === conversationId
        )
      },

      // Draft management
      setCurrentDraft: (draftId) =>
        set(() => ({ currentDraftId: draftId })),

      addDraft: (draft) =>
        set((state) => {
          const newDrafts = new Map(state.drafts)
          newDrafts.set(draft.id, draft)
          return { drafts: newDrafts }
        }),

      updateDraft: (draftId, updates) =>
        set((state) => {
          const draft = state.drafts.get(draftId)
          if (!draft) return state

          const updatedDraft = {
            ...draft,
            ...updates,
            updated_at: new Date().toISOString(),
          }

          const newDrafts = new Map(state.drafts)
          newDrafts.set(draftId, updatedDraft)
          return { drafts: newDrafts }
        }),

      removeDraft: (draftId) =>
        set((state) => {
          const newDrafts = new Map(state.drafts)
          newDrafts.delete(draftId)

          return {
            drafts: newDrafts,
            currentDraftId: state.currentDraftId === draftId ? undefined : state.currentDraftId,
          }
        }),

      getDraft: (draftId) => {
        const state = get()
        return state.drafts.get(draftId) || null
      },

      getDraftsForInput: (inputId) => {
        const state = get()
        return Array.from(state.drafts.values()).filter((draft) => draft.input_id === inputId)
      },

      // UI state
      setLoading: (isLoading) => set(() => ({ isLoading })),

      setSelectedDraftType: (selectedDraftType) =>
        set(() => ({ selectedDraftType })),

      setConversationFilter: (conversationFilter) =>
        set(() => ({ conversationFilter })),

      setSorting: (sortBy, sortOrder) =>
        set(() => ({ sortBy, sortOrder })),

      // Bulk operations
      loadConversations: (conversations) =>
        set(() => ({
          conversations: new Map(conversations.map((c) => [c.id, c])),
        })),

      loadInputs: (inputs) =>
        set(() => ({
          inputs: new Map(inputs.map((i) => [i.id, i])),
        })),

      loadDrafts: (drafts) =>
        set(() => ({
          drafts: new Map(drafts.map((d) => [d.id, d])),
        })),

      clearAll: () =>
        set(() => ({
          currentConversationId: undefined,
          currentInputId: undefined,
          currentDraftId: undefined,
          conversations: new Map(),
          inputs: new Map(),
          drafts: new Map(),
        })),

      // Analytics
      getConversationStats: () => {
        const state = get()
        const totalDrafts = Array.from(state.drafts.values())
        const completedDrafts = totalDrafts.filter((d) => d.cpl_score !== undefined)

        const averageCPL = completedDrafts.length > 0
          ? completedDrafts.reduce((sum, draft) => sum + (draft.cpl_score || 0), 0) / completedDrafts.length
          : 0

        return {
          totalConversations: state.conversations.size,
          totalInputs: state.inputs.size,
          totalDrafts: state.drafts.size,
          averageCPL: Math.round(averageCPL),
        }
      },
    }),
    {
      name: 'content-store',
      // Only persist essential data
      partialize: (state) => ({
        currentConversationId: state.currentConversationId,
        selectedDraftType: state.selectedDraftType,
        conversationFilter: state.conversationFilter,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      }),
    }
  )
)

// Selectors for common use cases
export const useCurrentConversation = () =>
  useContentStore((state) => {
    const id = state.currentConversationId
    return id ? state.conversations.get(id) || null : null
  })

export const useCurrentInput = () =>
  useContentStore((state) => {
    const id = state.currentInputId
    return id ? state.inputs.get(id) || null : null
  })

export const useCurrentDraft = () =>
  useContentStore((state) => {
    const id = state.currentDraftId
    return id ? state.drafts.get(id) || null : null
  })

export const useConversationList = () =>
  useContentStore((state) => {
    const conversations = Array.from(state.conversations.values())
    const { conversationFilter, sortBy, sortOrder } = state

    // Filter
    const filtered = conversationFilter
      ? conversations.filter((c) =>
          c.title.toLowerCase().includes(conversationFilter.toLowerCase()) ||
          c.description?.toLowerCase().includes(conversationFilter.toLowerCase())
        )
      : conversations

    // Sort
    return filtered.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortOrder === 'asc' ? comparison : -comparison
    })
  })

export const useContentActions = () =>
  useContentStore((state) => ({
    setCurrentConversation: state.setCurrentConversation,
    addConversation: state.addConversation,
    updateConversation: state.updateConversation,
    removeConversation: state.removeConversation,
    setCurrentInput: state.setCurrentInput,
    addInput: state.addInput,
    updateInput: state.updateInput,
    removeInput: state.removeInput,
    setCurrentDraft: state.setCurrentDraft,
    addDraft: state.addDraft,
    updateDraft: state.updateDraft,
    removeDraft: state.removeDraft,
    setSelectedDraftType: state.setSelectedDraftType,
    setConversationFilter: state.setConversationFilter,
    setSorting: state.setSorting,
    loadConversations: state.loadConversations,
    loadInputs: state.loadInputs,
    loadDrafts: state.loadDrafts,
    clearAll: state.clearAll,
  }))

export const useContentStats = () => useContentStore((state) => state.getConversationStats())