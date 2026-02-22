'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
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
                        ← Back to sign in
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <div className="mb-4 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Enter your email and we&apos;ll send you a link to reset your password
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                            placeholder="you@example.com"
                            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-4 py-2.5 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? 'Sending...' : 'Send reset link'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Remember your password?{' '}
                    <Link href={`/auth/login${source ? `?source=${source}` : ''}`} className="text-[hsl(var(--primary))] hover:underline font-medium">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}
