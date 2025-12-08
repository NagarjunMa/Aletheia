import { createClient, ensureUserProfile } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      try {
        // Ensure user profile exists in our database
        await ensureUserProfile(user)

        // Log successful authentication
        console.log(`User ${user.email} authenticated successfully`)

        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'

        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`)
        } else {
          return NextResponse.redirect(`${origin}${next}`)
        }
      } catch (profileError) {
        console.error('Error creating user profile:', profileError)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?message=profile_creation_failed`)
      }
    } else {
      console.error('Authentication callback error:', error?.message)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}