// Singleton Supabase Client to prevent multiple instances
// This fixes the infinite loading issue caused by auth conflicts

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

/**
 * Get or create a singleton Supabase client instance
 * This prevents multiple clients from being created which causes auth loops
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseInstance
}

/**
 * Force reset the client (useful for testing or after logout)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null
}