import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Fetch user preferences
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const theme = preferences?.theme ?? 'system'
  const formalityLevel = preferences?.formality_level ?? 'neutral'
  const responseLength = preferences?.response_length ?? 'medium'
  const preferredModel = preferences?.preferred_model ?? 'default'
  const enableStreaming = preferences?.enable_streaming ?? true
  const showCplScores = preferences?.show_cpl_scores ?? true
  const shareAnalytics = preferences?.share_analytics ?? false
  const dataRetentionDays = preferences?.data_retention_days ?? 90

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
            Your current preferences are shown below. Editing will be available soon.
          </p>
        </div>

        {/* Writing Preferences */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-5">Writing Preferences</h2>
          <div className="space-y-4">
            <SettingRow label="Formality Level" value={formatLabel(formalityLevel)} />
            <SettingRow label="Response Length" value={formatLabel(responseLength)} />
            <SettingRow label="Preferred Model" value={formatLabel(preferredModel)} />
          </div>
        </div>

        {/* Display Settings */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-5">Display</h2>
          <div className="space-y-4">
            <SettingRow label="Theme" value={formatLabel(theme)} />
            <SettingRow label="Show CPL Scores" value={showCplScores ? 'Enabled' : 'Disabled'} />
            <SettingRow label="Enable Streaming" value={enableStreaming ? 'Enabled' : 'Disabled'} />
          </div>
        </div>

        {/* Privacy */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Privacy</h2>
          <div className="space-y-4">
            <SettingRow label="Share Analytics" value={shareAnalytics ? 'Enabled' : 'Disabled'} />
            <SettingRow label="Data Retention" value={`${dataRetentionDays} days`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  )
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
