// Authentication Helper Functions
// Created: December 7, 2024
// Purpose: Authentication utilities and user management

import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type User = Database['public']['Tables']['profiles']['Insert']

// Client-side authentication helpers
export const auth = {
  // Sign up with email and password
  async signUp(email: string, password: string, userData?: Partial<User>) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData || {}
      }
    })

    return { data, error }
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    return { data, error }
  },

  // Sign in with Google OAuth
  async signInWithGoogle() {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    return { data, error }
  },

  // Sign out
  async signOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  async getCurrentUser() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Get current session
  async getSession() {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Reset password
  async resetPassword(email: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })

    return { data, error }
  },

  // Update password
  async updatePassword(newPassword: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })

    return { data, error }
  },

  // Update user metadata
  async updateUserMetadata(metadata: Record<string, any>) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    })

    return { data, error }
  }
}

// Server-side authentication helpers
export const serverAuth = {
  // Get authenticated user on server
  async getUser() {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Get user profile with authentication check
  async getUserProfile(userId?: string) {
    const supabase = createServerClient()

    let targetUserId = userId
    if (!targetUserId) {
      const { user } = await this.getUser()
      if (!user) return { profile: null, error: { message: 'Not authenticated' } }
      targetUserId = user.id
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    return { profile, error }
  },

  // Require authentication (throws if not authenticated)
  async requireAuth() {
    const { user, error } = await this.getUser()

    if (error || !user) {
      throw new Error('Authentication required')
    }

    return user
  },

  // Check if user has required permissions
  async checkPermissions(userId: string, resource: string, action: string) {
    // This is a placeholder for a more sophisticated permission system
    // For now, users can only access their own resources
    const { user } = await this.getUser()

    if (!user || user.id !== userId) {
      return false
    }

    return true
  }
}

// Profile management helpers
export const profileHelpers = {
  // Get user dashboard statistics
  async getDashboardStats(userId: string) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('user_dashboard_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    return { data, error }
  },

  // Update user profile
  async updateProfile(userId: string, updates: Partial<Profile>) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return { data, error }
  },

  // Update user preferences
  async updatePreferences(userId: string, preferences: Record<string, any>) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('profiles')
      .update({ preferences })
      .eq('id', userId)
      .select()
      .single()

    return { data, error }
  },

  // Delete user account
  async deleteAccount(userId: string) {
    const supabase = createClient()

    // Note: This will cascade delete due to foreign key constraints
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    return { error }
  }
}

// Session management
export const sessionHelpers = {
  // Log user session
  async logSession(userId: string, sessionData?: Record<string, any>) {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_data: sessionData || {},
        ip_address: '', // This would be filled by middleware
        user_agent: navigator.userAgent
      })
      .select()
      .single()

    return { data, error }
  },

  // End user session
  async endSession(sessionId: string) {
    const supabase = createClient()

    const { error } = await supabase
      .from('user_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    return { error }
  }
}

// Authentication state management
export function createAuthStateManager() {
  const supabase = createClient()

  return {
    // Subscribe to auth state changes
    onAuthStateChange(callback: (event: string, session: any) => void) {
      return supabase.auth.onAuthStateChange(callback)
    },

    // Get current session
    async getSession() {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },

    // Check if user is authenticated
    async isAuthenticated() {
      const session = await this.getSession()
      return !!session
    }
  }
}