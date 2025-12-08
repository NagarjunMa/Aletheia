import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from '@/lib/supabase/client'

export interface UserPreferences {
  // Display preferences
  theme: 'light' | 'dark' | 'system'
  fontSize: 'small' | 'medium' | 'large'
  fontFamily: 'inter' | 'serif' | 'mono'

  // Writing preferences
  defaultCategory: 'email' | 'letter' | 'proposal' | 'memo' | 'general'
  preferredDraftType: 'grammar_fix' | 'adaptive_polish' | 'both'
  autoSaveEnabled: boolean
  showCPLScore: boolean

  // Privacy preferences
  shareAnalytics: boolean
  saveHistory: boolean
  allowLearning: boolean

  // Notification preferences
  emailNotifications: boolean
  draftReminders: boolean
  weeklyReports: boolean

  // Advanced preferences
  customPrompts: Record<string, string>
  shortcuts: Record<string, string>
  maxHistoryDays: number
}

interface PreferencesState {
  preferences: UserPreferences
  isLoading: boolean
  isSaving: boolean
  lastSaved: Date | null
}

interface PreferencesActions {
  // Core actions
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void
  updatePreferences: (updates: Partial<UserPreferences>) => void
  resetPreferences: () => void

  // Persistence
  saveToServer: () => Promise<void>
  loadFromServer: () => Promise<void>
  syncPreferences: () => Promise<void>

  // Custom prompts
  addCustomPrompt: (name: string, prompt: string) => void
  removeCustomPrompt: (name: string) => void
  updateCustomPrompt: (name: string, prompt: string) => void

  // Shortcuts
  addShortcut: (key: string, action: string) => void
  removeShortcut: (key: string) => void
  updateShortcut: (key: string, action: string) => void

  // Utility
  exportPreferences: () => string
  importPreferences: (data: string) => void
}

const defaultPreferences: UserPreferences = {
  // Display
  theme: 'system',
  fontSize: 'medium',
  fontFamily: 'inter',

  // Writing
  defaultCategory: 'general',
  preferredDraftType: 'both',
  autoSaveEnabled: true,
  showCPLScore: true,

  // Privacy
  shareAnalytics: true,
  saveHistory: true,
  allowLearning: true,

  // Notifications
  emailNotifications: true,
  draftReminders: false,
  weeklyReports: false,

  // Advanced
  customPrompts: {},
  shortcuts: {
    'ctrl+enter': 'generate_drafts',
    'ctrl+s': 'save_draft',
    'escape': 'clear_input'
  },
  maxHistoryDays: 90,
}

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  persist(
    (set, get) => ({
      // Initial state
      preferences: defaultPreferences,
      isLoading: false,
      isSaving: false,
      lastSaved: null,

      // Core actions
      updatePreference: (key, value) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [key]: value
          }
        }))

        // Auto-save to server after a delay
        setTimeout(() => {
          get().saveToServer().catch(console.error)
        }, 1000)
      },

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...updates
          }
        }))

        // Auto-save to server after a delay
        setTimeout(() => {
          get().saveToServer().catch(console.error)
        }, 1000)
      },

      resetPreferences: () => {
        set({ preferences: defaultPreferences })
        get().saveToServer().catch(console.error)
      },

      // Persistence actions
      saveToServer: async () => {
        const { preferences } = get()
        set({ isSaving: true })

        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) return

          const { error } = await supabase
            .from('profiles')
            .update({
              preferences,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

          if (error) throw error

          set({ lastSaved: new Date() })
        } catch (error) {
          console.error('Failed to save preferences:', error)
          throw error
        } finally {
          set({ isSaving: false })
        }
      },

      loadFromServer: async () => {
        set({ isLoading: true })

        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) return

          const { data: profile, error } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', user.id)
            .single()

          if (error) throw error

          if (profile?.preferences) {
            set({
              preferences: {
                ...defaultPreferences,
                ...profile.preferences
              }
            })
          }
        } catch (error) {
          console.error('Failed to load preferences:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      syncPreferences: async () => {
        await get().loadFromServer()
      },

      // Custom prompts
      addCustomPrompt: (name, prompt) => {
        const { preferences } = get()
        get().updatePreference('customPrompts', {
          ...preferences.customPrompts,
          [name]: prompt
        })
      },

      removeCustomPrompt: (name) => {
        const { preferences } = get()
        const { [name]: removed, ...remaining } = preferences.customPrompts
        get().updatePreference('customPrompts', remaining)
      },

      updateCustomPrompt: (name, prompt) => {
        const { preferences } = get()
        get().updatePreference('customPrompts', {
          ...preferences.customPrompts,
          [name]: prompt
        })
      },

      // Shortcuts
      addShortcut: (key, action) => {
        const { preferences } = get()
        get().updatePreference('shortcuts', {
          ...preferences.shortcuts,
          [key]: action
        })
      },

      removeShortcut: (key) => {
        const { preferences } = get()
        const { [key]: removed, ...remaining } = preferences.shortcuts
        get().updatePreference('shortcuts', remaining)
      },

      updateShortcut: (key, action) => {
        const { preferences } = get()
        get().updatePreference('shortcuts', {
          ...preferences.shortcuts,
          [key]: action
        })
      },

      // Utility
      exportPreferences: () => {
        const { preferences } = get()
        return JSON.stringify(preferences, null, 2)
      },

      importPreferences: (data) => {
        try {
          const importedPreferences = JSON.parse(data)
          set({
            preferences: {
              ...defaultPreferences,
              ...importedPreferences
            }
          })
          get().saveToServer().catch(console.error)
        } catch (error) {
          console.error('Failed to import preferences:', error)
          throw new Error('Invalid preferences data')
        }
      },
    }),
    {
      name: 'ascendia-preferences',
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
)