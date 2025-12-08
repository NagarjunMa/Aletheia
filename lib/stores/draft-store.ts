import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

export interface DraftHistory {
  id: string
  content: string
  draft_type: 'grammar_fix' | 'adaptive_polish'
  cpl_score: number
  is_accepted: boolean | null
  user_edits: string | null
  created_at: string
  conversation_title: string
  original_input: string
}

export interface DraftAnalytics {
  totalDrafts: number
  acceptanceRate: number
  averageCPL: number
  preferredDraftType: 'grammar_fix' | 'adaptive_polish' | null
  improvementTrend: number // positive = getting better, negative = getting worse
}

interface DraftState {
  // History
  draftHistory: DraftHistory[]
  isLoadingHistory: boolean

  // Analytics
  analytics: DraftAnalytics | null
  isLoadingAnalytics: boolean

  // Current draft editing
  selectedDraft: DraftHistory | null
  editingContent: string
  isEditing: boolean

  // Export/sharing
  isExporting: boolean
  exportFormat: 'txt' | 'pdf' | 'docx'
}

interface DraftActions {
  // History management
  loadDraftHistory: (limit?: number) => Promise<void>
  clearHistory: () => void

  // Analytics
  loadAnalytics: () => Promise<void>
  refreshAnalytics: () => Promise<void>

  // Draft editing
  selectDraft: (draft: DraftHistory) => void
  startEditing: (draft: DraftHistory) => void
  updateEditingContent: (content: string) => void
  saveEdits: () => Promise<void>
  cancelEditing: () => void

  // Export functionality
  exportDraft: (draft: DraftHistory, format: 'txt' | 'pdf' | 'docx') => Promise<void>
  exportHistory: (format: 'csv' | 'json') => Promise<void>

  // Bulk operations
  bulkAccept: (draftIds: string[]) => Promise<void>
  bulkReject: (draftIds: string[]) => Promise<void>
  deleteDrafts: (draftIds: string[]) => Promise<void>
}

export const useDraftStore = create<DraftState & DraftActions>((set, get) => ({
  // Initial state
  draftHistory: [],
  isLoadingHistory: false,
  analytics: null,
  isLoadingAnalytics: false,
  selectedDraft: null,
  editingContent: '',
  isEditing: false,
  isExporting: false,
  exportFormat: 'txt',

  // History actions
  loadDraftHistory: async (limit = 50) => {
    set({ isLoadingHistory: true })
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('generated_drafts')
        .select(`
          id,
          content,
          draft_type,
          cpl_score,
          is_accepted,
          user_edits,
          created_at,
          user_inputs!inner(
            raw_text,
            conversations!inner(title)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const formattedHistory: DraftHistory[] = data.map(draft => ({
        id: draft.id,
        content: draft.content,
        draft_type: draft.draft_type,
        cpl_score: draft.cpl_score,
        is_accepted: draft.is_accepted,
        user_edits: draft.user_edits,
        created_at: draft.created_at,
        conversation_title: draft.user_inputs.conversations.title,
        original_input: draft.user_inputs.raw_text
      }))

      set({ draftHistory: formattedHistory })
    } catch (error) {
      console.error('Failed to load draft history:', error)
    } finally {
      set({ isLoadingHistory: false })
    }
  },

  clearHistory: () => set({ draftHistory: [] }),

  // Analytics actions
  loadAnalytics: async () => {
    set({ isLoadingAnalytics: true })
    const supabase = createClient()

    try {
      // Get total counts and acceptance rates
      const { data: drafts, error } = await supabase
        .from('generated_drafts')
        .select('draft_type, cpl_score, is_accepted, created_at')
        .not('is_accepted', 'is', null)

      if (error) throw error

      if (drafts.length === 0) {
        set({ analytics: null })
        return
      }

      // Calculate analytics
      const totalDrafts = drafts.length
      const acceptedDrafts = drafts.filter(d => d.is_accepted).length
      const acceptanceRate = (acceptedDrafts / totalDrafts) * 100

      const averageCPL = drafts.reduce((sum, d) => sum + d.cpl_score, 0) / drafts.length

      // Find preferred draft type
      const grammarFixCount = drafts.filter(d =>
        d.draft_type === 'grammar_fix' && d.is_accepted
      ).length
      const adaptivePolishCount = drafts.filter(d =>
        d.draft_type === 'adaptive_polish' && d.is_accepted
      ).length

      let preferredDraftType: 'grammar_fix' | 'adaptive_polish' | null = null
      if (grammarFixCount > adaptivePolishCount) {
        preferredDraftType = 'grammar_fix'
      } else if (adaptivePolishCount > grammarFixCount) {
        preferredDraftType = 'adaptive_polish'
      }

      // Calculate improvement trend (last 10 vs previous 10)
      const sortedDrafts = drafts
        .filter(d => d.is_accepted)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      let improvementTrend = 0
      if (sortedDrafts.length >= 10) {
        const recent = sortedDrafts.slice(0, 10)
        const previous = sortedDrafts.slice(10, 20)

        const recentAvgCPL = recent.reduce((sum, d) => sum + d.cpl_score, 0) / recent.length
        const previousAvgCPL = previous.reduce((sum, d) => sum + d.cpl_score, 0) / previous.length

        improvementTrend = recentAvgCPL - previousAvgCPL
      }

      const analytics: DraftAnalytics = {
        totalDrafts,
        acceptanceRate,
        averageCPL,
        preferredDraftType,
        improvementTrend
      }

      set({ analytics })
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      set({ isLoadingAnalytics: false })
    }
  },

  refreshAnalytics: async () => {
    await get().loadAnalytics()
  },

  // Draft editing actions
  selectDraft: (draft) => set({ selectedDraft: draft }),

  startEditing: (draft) => set({
    selectedDraft: draft,
    editingContent: draft.content,
    isEditing: true
  }),

  updateEditingContent: (content) => set({ editingContent: content }),

  saveEdits: async () => {
    const { selectedDraft, editingContent } = get()
    if (!selectedDraft) return

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('generated_drafts')
        .update({
          user_edits: editingContent,
          is_accepted: true
        })
        .eq('id', selectedDraft.id)

      if (error) throw error

      // Update local state
      set((state) => ({
        draftHistory: state.draftHistory.map(draft =>
          draft.id === selectedDraft.id
            ? { ...draft, user_edits: editingContent, is_accepted: true }
            : draft
        ),
        isEditing: false,
        editingContent: ''
      }))

    } catch (error) {
      console.error('Failed to save edits:', error)
      throw error
    }
  },

  cancelEditing: () => set({
    isEditing: false,
    editingContent: '',
    selectedDraft: null
  }),

  // Export actions
  exportDraft: async (draft, format) => {
    set({ isExporting: true, exportFormat: format })

    try {
      const response = await fetch('/api/drafts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draft.id,
          format
        })
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `draft-${draft.id}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export draft:', error)
      throw error
    } finally {
      set({ isExporting: false })
    }
  },

  exportHistory: async (format) => {
    const { draftHistory } = get()
    set({ isExporting: true })

    try {
      let content: string
      let filename: string

      if (format === 'json') {
        content = JSON.stringify(draftHistory, null, 2)
        filename = 'draft-history.json'
      } else {
        // CSV format
        const headers = ['ID', 'Content', 'Type', 'CPL Score', 'Accepted', 'Created At', 'Conversation']
        const rows = draftHistory.map(draft => [
          draft.id,
          `"${draft.content.replace(/"/g, '""')}"`,
          draft.draft_type,
          draft.cpl_score,
          draft.is_accepted,
          draft.created_at,
          `"${draft.conversation_title.replace(/"/g, '""')}"`
        ])

        content = [headers, ...rows].map(row => row.join(',')).join('\n')
        filename = 'draft-history.csv'
      }

      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export history:', error)
      throw error
    } finally {
      set({ isExporting: false })
    }
  },

  // Bulk operations
  bulkAccept: async (draftIds) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('generated_drafts')
        .update({ is_accepted: true })
        .in('id', draftIds)

      if (error) throw error

      // Update local state
      set((state) => ({
        draftHistory: state.draftHistory.map(draft =>
          draftIds.includes(draft.id)
            ? { ...draft, is_accepted: true }
            : draft
        )
      }))

    } catch (error) {
      console.error('Failed to bulk accept:', error)
      throw error
    }
  },

  bulkReject: async (draftIds) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('generated_drafts')
        .update({ is_accepted: false })
        .in('id', draftIds)

      if (error) throw error

      // Update local state
      set((state) => ({
        draftHistory: state.draftHistory.map(draft =>
          draftIds.includes(draft.id)
            ? { ...draft, is_accepted: false }
            : draft
        )
      }))

    } catch (error) {
      console.error('Failed to bulk reject:', error)
      throw error
    }
  },

  deleteDrafts: async (draftIds) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('generated_drafts')
        .delete()
        .in('id', draftIds)

      if (error) throw error

      // Update local state
      set((state) => ({
        draftHistory: state.draftHistory.filter(draft => !draftIds.includes(draft.id))
      }))

    } catch (error) {
      console.error('Failed to delete drafts:', error)
      throw error
    }
  },
}))