'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  )
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const source = searchParams.get('source')

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password${source ? '?source=extension' : ''}`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">
            We sent a password reset link to
          </p>
          <p className="text-sm text-white font-medium mb-6">{email}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-6">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <button
              onClick={() => setSent(false)}
              className="text-[hsl(var(--primary))] hover:underline font-medium"
            >
              try again
            </button>
          </p>
          <Link
            href={`/auth/login${source ? `?source=${source}` : ''}`}
            className="text-sm text-[hsl(var(--primary))] hover:underline font-medium"
          >
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px] mx-auto animate-fade-in">
      {/* Logo + brand */}
      <div className="flex items-center gap-3 mb-10">
        <Image src="/Aletheia.svg" alt="Aletheia" width={36} height={36} className="rounded-lg" />
        <span style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontWeight: 300, fontSize: '1.4rem', color: 'white', letterSpacing: '0.04em' }}>Aletheia</span>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-white mb-2">Reset your password</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-8">
        Enter your email and we&apos;ll send you a link to reset your password
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Remember your password?{' '}
        <Link href={`/auth/login${source ? `?source=${source}` : ''}`} className="text-[hsl(var(--primary))] hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
