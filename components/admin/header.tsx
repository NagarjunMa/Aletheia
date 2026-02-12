/**
 * Admin Header Component
 *
 * Top navigation bar for admin area
 * - User profile dropdown
 * - System status indicators
 * - Quick actions
 * - Notifications
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  Shield,
  User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AdminHeaderProps {
  user: {
    id: string
    email: string
    fullName: string
    role: string
  }
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Sign out error:', error)
        return
      }

      router.push('/auth/login')
      router.refresh()
    } catch (error) {
      console.error('Failed to sign out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400 border-red-400/50'
      case 'manager':
        return 'text-blue-400 border-blue-400/50'
      case 'analyst':
        return 'text-green-400 border-green-400/50'
      default:
        return 'text-gray-400 border-gray-400/50'
    }
  }

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left Side - Breadcrumb/Title */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-400">
              System administration and monitoring
            </p>
          </div>
        </div>

        {/* Center - System Status */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300">All Systems Operational</span>
          </div>

          <Badge variant="outline" className="text-ascendia-accent border-ascendia-accent/50">
            Real-time Monitoring Active
          </Badge>
        </div>

        {/* Right Side - Actions & Profile */}
        <div className="flex items-center gap-4">
          {/* Quick Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Link href="/admin/monitoring">
              <Button variant="outline" size="sm">
                <Shield className="w-4 h-4 mr-2" />
                Monitor
              </Button>
            </Link>

            <Link href="/admin/analytics">
              <Button variant="outline" size="sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </Link>
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <Bell className="w-4 h-4" />
                {/* Notification badge */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">2</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>System Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <div className="space-y-2 p-2">
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">High Memory Usage Detected</p>
                      <p className="text-xs text-gray-400">Memory engine using 85% of allocated resources</p>
                      <p className="text-xs text-gray-500 mt-1">2 minutes ago</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Security Scan Completed</p>
                      <p className="text-xs text-gray-400">No vulnerabilities detected in latest scan</p>
                      <p className="text-xs text-gray-500 mt-1">5 minutes ago</p>
                    </div>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/monitoring" className="w-full">
                  View All Notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 px-3 py-2 h-auto">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="" alt={user.fullName} />
                  <AvatarFallback className="bg-ascendia-accent text-black text-sm font-medium">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-white">{user.fullName}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>

                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                  <Badge
                    variant="outline"
                    size="sm"
                    className={getRoleColor(user.role)}
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  User Dashboard
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Admin Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={isLoading}
                className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile System Status */}
      <div className="md:hidden mt-3 pt-3 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300">All Systems OK</span>
          </div>

          <Badge variant="outline" className="text-ascendia-accent border-ascendia-accent/50 text-xs">
            Live
          </Badge>
        </div>
      </div>
    </header>
  )
}