'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

interface StylePatterns {
  avgSentenceLength: number
  formality: number
  greetingStyle: string
  closingStyle: string
  useContractions: boolean
  questionCount: number
  commonPhrases: string[]
}

interface Preferences {
  formality_level: string | null
  theme: string | null
  share_analytics: boolean | null
  style_patterns: StylePatterns | null
  approved_message_count: number | null
}

function formalityLabel(score: number): string {
  if (score <= 33) return 'Casual'
  if (score <= 66) return 'Neutral'
  return 'Formal'
}

function formalityColor(score: number): string {
  if (score <= 33) return 'text-emerald-400'
  if (score <= 66) return 'text-blue-400'
  return 'text-violet-400'
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [prefs, setPrefs] = useState<Preferences>({
    formality_level: 'neutral',
    theme: 'system',
    share_analytics: false,
    style_patterns: null,
    approved_message_count: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    async function loadPrefs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('user_preferences')
        .select('formality_level, theme, share_analytics, style_patterns, approved_message_count')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setPrefs({
          formality_level: data.formality_level ?? 'neutral',
          theme: data.theme ?? 'system',
          share_analytics: data.share_analytics ?? false,
          style_patterns: (data.style_patterns as StylePatterns | null) ?? null,
          approved_message_count: data.approved_message_count ?? 0,
        })
      }
      setLoading(false)
    }
    loadPrefs()
  }, [supabase, router])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formality_level: prefs.formality_level,
        theme: prefs.theme,
        share_analytics: prefs.share_analytics,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSavedMsg('Saved')
      setTimeout(() => setSavedMsg(''), 2000)
    }
  }

  async function handleResetStyle() {
    setResetting(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset_style: true }),
    })
    setResetting(false)
    if (res.ok) {
      setPrefs(p => ({ ...p, style_patterns: null, approved_message_count: 0 }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  const style = prefs.style_patterns
  const approvedCount = prefs.approved_message_count ?? 0

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl animate-fade-in">

        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-white transition-colors mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Manage your preferences and voice profile.
          </p>
        </div>

        {/* Voice Profile Card */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Your Voice Profile</h2>
              {approvedCount > 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Learned from {approvedCount} approved {approvedCount === 1 ? 'message' : 'messages'}
                </p>
              )}
            </div>
            {style && (
              <button
                onClick={handleResetStyle}
                disabled={resetting}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                {resetting ? 'Clearing…' : 'Reset style'}
              </button>
            )}
          </div>

          {style ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StyleTag label="Tone" value={formalityLabel(style.formality)} color={formalityColor(style.formality)} />
              <StyleTag label="Contractions" value={style.useContractions ? 'Yes' : 'No'} />
              <StyleTag label="Greeting" value={style.greetingStyle || '—'} />
              <StyleTag label="Closing" value={style.closingStyle || '—'} />
              <StyleTag label="Avg sentence" value={`${Math.round(style.avgSentenceLength)} words`} />
              <StyleTag label="Questions" value={style.questionCount > 0 ? `${style.questionCount}/msg` : 'None'} />
              {style.commonPhrases?.length > 0 && (
                <div className="col-span-2 sm:col-span-3 mt-1">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Common phrases</p>
                  <div className="flex flex-wrap gap-2">
                    {style.commonPhrases.slice(0, 5).map((phrase) => (
                      <span
                        key={phrase}
                        className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-0.5 text-xs text-white"
                      >
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {approvedCount === 0
                ? 'Generate and approve messages in the extension to start learning your voice.'
                : `${approvedCount} message approved — approve ${3 - approvedCount} more to unlock full style learning.`}
            </p>
          )}
        </div>

        {/* Writing Preferences */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-5">Writing Preferences</h2>
          <div className="space-y-4">
            <SelectField
              label="Formality Level"
              value={prefs.formality_level ?? 'neutral'}
              options={[
                { value: 'casual', label: 'Casual' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'formal', label: 'Formal' },
              ]}
              onChange={(v) => setPrefs(p => ({ ...p, formality_level: v }))}
            />
          </div>
        </div>

        {/* Display */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-5">Display</h2>
          <div className="space-y-4">
            <SelectField
              label="Theme"
              value={prefs.theme ?? 'system'}
              options={[
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              onChange={(v) => setPrefs(p => ({ ...p, theme: v }))}
            />
          </div>
        </div>

        {/* Privacy */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-5">Privacy</h2>
          <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
            <div>
              <p className="text-sm text-white">Share Analytics</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Help improve Aletheia with anonymised usage data</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs.share_analytics ?? false}
              onClick={() => setPrefs(p => ({ ...p, share_analytics: !p.share_analytics }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${prefs.share_analytics ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs.share_analytics ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          {savedMsg && <span className="text-sm text-emerald-400">{savedMsg}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

      </div>
    </div>
  )
}

function StyleTag({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${color ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (_v: string) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-medium text-white focus:outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[hsl(var(--card))] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
