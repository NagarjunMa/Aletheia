import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const feedbackSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(320),
  message: z.string().min(10).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
  honeypot: z.string().max(0).optional(),
})

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    // Honeypot check
    if (parsed.data.honeypot) {
      return NextResponse.json({ success: true })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase.from('feedback').insert({
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
      rating: parsed.data.rating ?? null,
      page_url: req.headers.get('referer') || null,
      user_agent: req.headers.get('user-agent') || null,
    })

    if (error) {
      console.error('Feedback insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
