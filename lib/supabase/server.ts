// Supabase Server Configuration
// Created: December 7, 2024
// Purpose: Server-side Supabase client for Server Actions and SSR

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { Database, ProfileInsert } from '@/lib/database/types'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Service Role client for admin operations (use carefully!)
export function createServiceClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Handle cookie setting errors
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Handle cookie removal errors
          }
        },
      },
    }
  )
}

// Helper function to get authenticated user
export async function getUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('Error getting user:', error.message)
    return null
  }

  return user
}

// Helper function to get user profile
export async function getUserProfile(userId?: string) {
  const supabase = createClient()

  let targetUserId = userId
  if (!targetUserId) {
    const user = await getUser()
    if (!user) return null
    targetUserId = user.id
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (error) {
    console.error('Error getting profile:', error.message)
    return null
  }

  return profile
}

// Helper function to check if user exists and create profile if needed
export async function ensureUserProfile(user: User) {
  const supabase = createClient()

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existingProfile) {
    return existingProfile
  }

  // Create profile if it doesn't exist
  const insert: ProfileInsert = {
    id: user.id,
    email: user.email ?? '',
    full_name: (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    preferences: {
      theme: 'system',
      language: 'en',
      notifications: true,
      auto_save: true,
      default_category: 'general',
    },
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert(insert)
    .select()
    .single()

  if (error) {
    console.error('Error creating profile:', error.message)
    throw error
  }

  return newProfile
}

// Type-safe table access helpers for server (updated after cleanup)
export function getServerTables() {
  const supabase = createClient()

  return {
    profiles: () => supabase.from('profiles'),
    conversations: () => supabase.from('conversations'),
    user_inputs: () => supabase.from('user_inputs'),
    generated_drafts: () => supabase.from('generated_drafts'),
    user_feedback: () => supabase.from('user_feedback'),
    user_preferences: () => supabase.from('user_preferences'),
    usage_analytics: () => supabase.from('usage_analytics'),
    production_metrics: () => supabase.from('production_metrics'),
    messages: () => supabase.from('messages'),
  }
}

// Service role table access (admin operations, updated after cleanup)
export function getServiceTables() {
  const supabase = createServiceClient()

  return {
    profiles: () => supabase.from('profiles'),
    conversations: () => supabase.from('conversations'),
    user_inputs: () => supabase.from('user_inputs'),
    generated_drafts: () => supabase.from('generated_drafts'),
    user_feedback: () => supabase.from('user_feedback'),
    user_preferences: () => supabase.from('user_preferences'),
    usage_analytics: () => supabase.from('usage_analytics'),
    production_metrics: () => supabase.from('production_metrics'),
    messages: () => supabase.from('messages'),
  }
}