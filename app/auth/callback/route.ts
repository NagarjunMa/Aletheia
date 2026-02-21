import { NextResponse } from 'next/server'
import { createClient, ensureUserProfile } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') || '/'
  const source = searchParams.get('source')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      try {
        await ensureUserProfile(data.user)
      } catch (err) {
        console.error('Failed to ensure user profile:', err)
      }

      // If signup came from extension, redirect to login page so the
      // auth-bridge content script can detect the session and auto-close the tab
      if (source === 'extension') {
        return NextResponse.redirect(`${origin}/auth/login?source=extension`)
      }

      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Could not verify email`)
}
