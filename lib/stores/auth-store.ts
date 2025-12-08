import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  cpl_score: number
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  initialize: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // State
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  // Actions
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    const supabase = createClient()

    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user })
        await get().refreshProfile()
      }

      // Listen to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          set({ user: session?.user ?? null })

          if (session?.user) {
            await get().refreshProfile()
          } else {
            set({ profile: null })
          }

          set({ isLoading: false })
        }
      )

      set({ isInitialized: true, isLoading: false })

      return () => {
        subscription.unsubscribe()
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      set({ isLoading: false, isInitialized: true })
    }
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return

    const supabase = createClient()

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        // Profile might not exist yet, create one
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
              cpl_score: 50, // Default CPL score
              preferences: {}
            })
            .select()
            .single()

          if (insertError) throw insertError
          set({ profile: newProfile })
        } else {
          throw error
        }
      } else {
        set({ profile })
      }
    } catch (error) {
      console.error('Failed to fetch/create profile:', error)
    }
  },

  signOut: async () => {
    const supabase = createClient()
    set({ isLoading: true })

    try {
      await supabase.auth.signOut()
      set({ user: null, profile: null })
    } catch (error) {
      console.error('Failed to sign out:', error)
    } finally {
      set({ isLoading: false })
    }
  },
}))

// Initialize auth on store creation (client-side only)
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize()
}