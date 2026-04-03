import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const log = createLogger('settings-api')

const settingsSchema = z.object({
  formality_level: z.enum(['casual', 'neutral', 'formal']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  share_analytics: z.boolean().optional(),
  reset_style: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { reset_style, ...prefs } = parsed.data

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    ...prefs,
  }

  if (reset_style) {
    upsertData.style_patterns = null
    upsertData.approved_message_count = 0
    upsertData.rejected_message_count = 0
    log.info({ userId: user.id }, 'Resetting user style profile')
  }

  const { data, error } = await supabase
    .from('user_preferences')
    // eslint-disable-next-line
    .upsert(upsertData as never, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    log.error({ err: error.message }, 'Failed to update user preferences')
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json({ success: true, preferences: data })
}
