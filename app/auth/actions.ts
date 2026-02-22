'use server'

import { ensureUserProfile } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function ensureProfileAction() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: 'Not authenticated' }
  }

  try {
    await ensureUserProfile(user)
    return { success: true }
  } catch (err) {
    return { error: 'Failed to create profile' }
  }
}
