'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const source = searchParams.get('source')

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [sessionReady, setSessionReady] = useState(false)
    const [sessionError, setSessionError] = useState(false)

    // Supabase sends a recovery link with a code fragment in the URL.
    // The client library auto-exchanges it for a session via onAuthStateChange.
    useEffect(() => {
        const supabase = createClient()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true)
            }
        })

        // Also check if already in a recovery session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setSessionReady(true)
            }
        })

        // Timeout - if no recovery event after 5s, the link may be invalid
        const timeout = setTimeout(() => {
            if (!sessionReady) {
                setSessionError(true)
            }
        }, 5000)

        return () => {
            subscription.unsubscribe()
            clearTimeout(timeout)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        setLoading(true)

        const supabase = createClient()
        const { error: updateError } = await supabase.auth.updateUser({
            password,
        })

        if (updateError) {
            if (updateError.message.includes('same password')) {
                setError('New password must be different from your current password')
            } else {
                setError(updateError.message)
            }
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)
    }

    // Error state - invalid or expired reset link
    if (sessionError && !sessionReady) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in text-center">
                    <div className="mb-4 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-[hsl(var(--destructive))]/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-[hsl(var(--destructive))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Invalid reset link</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                        This password reset link has expired or is invalid. Please request a new one.
                    </p>
                    <Link
                        href={`/auth/forgot-password${source ? `?source=${source}` : ''}`}
                        className="inline-block rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 transition-all"
                    >
                        Request new link
                    </Link>
                </div>
            </div>
        )
    }

    // Success state
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
                    <h1 className="text-2xl font-bold text-white mb-2">Password updated!</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                        Your password has been reset successfully. You can now sign in with your new password.
                    </p>
                    <Link
                        href={`/auth/login${source ? `?source=${source}` : ''}`}
                        className="inline-block rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 transition-all"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        )
    }

    // Loading state - waiting for recovery session
    if (!sessionReady) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in text-center">
                    <div className="mb-4 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Verifying reset link...
                    </p>
                </div>
            </div>
        )
    }

    // Password reset form
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <div className="mb-4 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Choose a strong password for your account
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                            New password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoFocus
                            placeholder="••••••••"
                            minLength={6}
                            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-4 py-2.5 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                            Confirm new password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            minLength={6}
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
                        {loading ? 'Updating...' : 'Update password'}
                    </button>
                </form>
            </div>
        </div>
    )
}
