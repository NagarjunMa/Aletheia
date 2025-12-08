// Supabase Client Configuration
// Created: December 7, 2024
// Purpose: Client-side Supabase client for browser usage

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database/types'

// Create a single supabase client for interacting with the database
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Export a default instance for convenience
export const supabase = createClient()

// Type-safe table access helpers
export const Tables = {
  profiles: () => supabase.from('profiles'),
  conversations: () => supabase.from('conversations'),
  user_inputs: () => supabase.from('user_inputs'),
  generated_drafts: () => supabase.from('generated_drafts'),
  api_usage_logs: () => supabase.from('api_usage_logs'),
  user_sessions: () => supabase.from('user_sessions'),
  user_feedback: () => supabase.from('user_feedback'),
}

// Views access
export const Views = {
  user_dashboard_stats: () => supabase.from('user_dashboard_stats'),
  conversation_details: () => supabase.from('conversation_details'),
}