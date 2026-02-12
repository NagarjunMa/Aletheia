/**
 * Admin Area Layout
 *
 * Protected layout for admin functionality with role-based access control
 * - Authentication verification
 * - Role-based access control
 * - Admin navigation
 * - Responsive design
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminHeader } from '@/components/admin/header'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Shield } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Verify authentication and admin access
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirectTo=/admin')
  }

  // Check user profile and role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, preferences')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    redirect('/auth/login?redirectTo=/admin')
  }

  const userRole = profile.preferences?.role
  const allowedRoles = ['admin', 'manager']

  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center border-red-500/50 bg-red-500/10">
          <div className="flex flex-col items-center space-y-4">
            <Shield className="w-12 h-12 text-red-400" />
            <h1 className="text-xl font-bold text-red-400">Access Denied</h1>
            <p className="text-gray-300">
              You don't have permission to access the admin area.
            </p>
            <p className="text-sm text-gray-400">
              Current role: <span className="font-medium">{userRole || 'unknown'}</span>
            </p>
            <p className="text-sm text-gray-400">
              Required role: Admin or Manager
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-ascendia-accent text-black rounded-lg hover:bg-ascendia-accent/90 transition-colors"
            >
              Return to Dashboard
            </a>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="flex h-screen">
        {/* Sidebar */}
        <AdminSidebar userRole={userRole} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <AdminHeader
            user={{
              id: user.id,
              email: user.email || '',
              fullName: profile.full_name || 'Admin User',
              role: userRole
            }}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <Suspense fallback={<AdminLoadingFallback />}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}

function AdminLoadingFallback() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-800 rounded w-64"></div>
          <div className="h-4 bg-gray-800 rounded w-96"></div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  )
}