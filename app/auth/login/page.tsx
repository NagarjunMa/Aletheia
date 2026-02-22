'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ensureProfileAction } from '@/app/auth/actions'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const source = searchParams.get('source')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Auto-detect existing session on mount (e.g., after email confirmation redirect)
  useEffect(() => {
    if (source !== 'extension') return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        console.log('[LOGIN] User already authenticated after email confirmation:', user.email)
        setSuccess(true)
      }
    })
  }, [source])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      // Map Supabase errors to friendly messages
      const msg = signInError.message.toLowerCase()
      if (msg.includes('invalid login credentials')) {
        setError('Incorrect email or password. Please check your credentials and try again.')
      } else if (msg.includes('email not confirmed')) {
        setError('Your email hasn\'t been verified yet. Please check your inbox for a confirmation link.')
      } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
        setError('Too many login attempts. Please wait a moment and try again.')
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Unable to connect to the server. Please check your internet connection.')
      } else {
        setError(signInError.message)
      }
      setLoading(false)
      return
    }

    await ensureProfileAction()

    if (source === 'extension') {
      setLoading(false)
      setSuccess(true)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Login successful!</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
            This tab will close automatically. You can return to the extension.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Sign in to your Ascendia account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-4 py-2.5 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-[hsl(var(--muted-foreground))]">
                Password
              </label>
              <Link
                href={`/auth/forgot-password${source ? `?source=${source}` : ''}`}
                className="text-xs text-[hsl(var(--primary))] hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-4 py-2.5 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
            />
          </div>

          {error && (
            <div className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Don&apos;t have an account?{' '}
          <Link href={`/auth/register${source ? `?source=${source}` : ''}`} className="text-[hsl(var(--primary))] hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

