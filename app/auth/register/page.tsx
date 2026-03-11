'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Mail, Lock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Shared theme tokens ─────────────────────────── */
const T = {
  bg:        '#000000',
  surface:   'rgba(255, 255, 255, 0.04)',
  surface2:  'rgba(255, 255, 255, 0.07)',
  text:      '#CBEFEB',
  muted:     '#48A89A',
  dim:       'rgba(203,239,235,0.40)',
  border:    'rgba(203,239,235,0.12)',
  accent:    '#48A89A',
  error:     'rgba(239,68,68,0.12)',
  errorText: '#f87171',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 0,
  padding: '0.75rem 0.875rem 0.75rem 2.75rem',
  fontSize: '0.875rem',
  color: T.text,
  outline: 'none',
  transition: 'border-color 0.2s ease',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.muted,
  marginBottom: '0.5rem',
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: T.dim, pointerEvents: 'none' }}>
      {children}
    </span>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 0' }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const source = searchParams.get('source')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: source === 'extension'
          ? `${window.location.origin}/auth/callback?source=extension`
          : `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleOAuthSignIn(provider: 'google' | 'github') {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback${source ? '?source=extension' : ''}` },
    })
  }

  /* ── Success state ── */
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: 'center', padding: '2.5rem', border: `1px solid ${T.border}`, background: T.surface }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✉️</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: '1.4rem', color: T.text, marginBottom: '0.5rem' }}>Check your email</h1>
        <p style={{ fontSize: '0.85rem', color: T.muted, lineHeight: 1.6, marginBottom: '1.5rem' }}>
          We sent a confirmation link to{' '}
          <span style={{ color: T.text, fontWeight: 600 }}>{email}</span>.
          Click the link to activate your account.
        </p>
        <Link
          href={`/auth/login${source ? `?source=${source}` : ''}`}
          style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.accent, textDecoration: 'none' }}
        >
          ← Back to sign in
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <Image src="/Aletheia.svg" alt="Aletheia" width={28} height={28} />
        <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: T.text, letterSpacing: '0.06em' }}>Aletheia</span>
      </div>

      {/* Heading */}
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(1.8rem, 3vw, 2.2rem)', color: T.text, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
        Create account
      </h1>
      <p style={{ color: T.muted, fontSize: '0.875rem', marginBottom: '2rem' }}>Get started with Aletheia</p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" style={labelStyle}>Full name</label>
          <div style={{ position: 'relative' }}>
            <FieldIcon><User size={14} /></FieldIcon>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="Jane Doe"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = T.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" style={labelStyle}>Email</label>
          <div style={{ position: 'relative' }}>
            <FieldIcon><Mail size={14} /></FieldIcon>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = T.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <FieldIcon><Lock size={14} /></FieldIcon>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = T.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" style={labelStyle}>Confirm password</label>
          <div style={{ position: 'relative' }}>
            <FieldIcon><Lock size={14} /></FieldIcon>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = T.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: T.error, border: '1px solid rgba(239,68,68,0.2)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: T.errorText }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </motion.div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.85rem',
            marginTop: '0.25rem',
            background: loading ? T.surface2 : T.accent,
            border: `1px solid ${loading ? T.border : T.accent}`,
            borderRadius: 0,
            color: '#051F20',
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.75rem 0' }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: '0.65rem', color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>or continue with</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      {/* OAuth */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {(['google', 'github'] as const).map(provider => (
          <button
            key={provider}
            type="button"
            onClick={() => handleOAuthSignIn(provider)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.7rem',
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: 0,
              color: T.muted,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'border-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.text }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted }}
          >
            {provider === 'google' ? (
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            ) : (
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            )}
            {provider === 'google' ? 'Google' : 'GitHub'}
          </button>
        ))}
      </div>

      {/* Footer link */}
      <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: T.dim }}>
        Already have an account?{' '}
        <Link
          href={`/auth/login${source ? `?source=${source}` : ''}`}
          style={{ color: T.accent, fontWeight: 700, textDecoration: 'none' }}
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  )
}
