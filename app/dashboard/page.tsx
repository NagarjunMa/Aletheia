import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch counts + recent messages in parallel
  const [rateLimitResult, draftsResult, recentResult] = await Promise.all([
    supabase
      .from('extension_rate_limits')
      .select('request_count')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('generated_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('generated_drafts')
      .select('id, content, cpl_score, draft_type, is_accepted, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const todayUsage = rateLimitResult.data?.request_count ?? 0
  const totalDrafts = draftsResult.count ?? 0
  const recentDrafts = recentResult.data ?? []
  const cplScore = profile?.cpl_score ?? 0

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl animate-fade-in">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {displayName}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {user.email}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-10">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/20">
                <svg className="h-5 w-5 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Today&apos;s Usage
              </p>
            </div>
            <p className="text-3xl font-bold text-white">{todayUsage} <span className="text-base font-normal text-[hsl(var(--muted-foreground))]">/ 30</span></p>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/20">
                <svg className="h-5 w-5 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Drafts Generated
              </p>
            </div>
            <p className="text-3xl font-bold text-white">{totalDrafts}</p>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/20">
                <svg className="h-5 w-5 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                CPL Score
              </p>
            </div>
            <p className="text-3xl font-bold text-white">{cplScore.toFixed(1)}</p>
          </div>
        </div>

        {/* Recent Messages */}
        {recentDrafts.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Messages</h2>
            <div className="space-y-3">
              {recentDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {draft.content?.slice(0, 90)}{(draft.content?.length ?? 0) > 90 ? '…' : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] capitalize">
                        {(draft.draft_type ?? 'message').replace(/_/g, ' ')}
                      </span>
                      {draft.is_accepted && (
                        <span className="text-xs text-emerald-400">✓ Approved</span>
                      )}
                    </div>
                  </div>
                  {draft.cpl_score != null && (
                    <span className={`shrink-0 text-sm font-semibold ${
                      draft.cpl_score >= 70 ? 'text-emerald-400' :
                      draft.cpl_score >= 40 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {Math.round(draft.cpl_score)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm text-white transition-colors hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--secondary))]"
            >
              <svg className="h-5 w-5 text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              View Profile
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm text-white transition-colors hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--secondary))]"
            >
              <svg className="h-5 w-5 text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
