/**
 * Admin Sidebar Navigation
 *
 * Responsive sidebar for admin area navigation
 * - Role-based menu items
 * - Active state indicators
 * - Collapsible design
 * - Quick access shortcuts
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  Database,
  Home,
  Settings,
  Shield,
  TrendingUp,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  userRole: string
}

export function AdminSidebar({ userRole }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  const navigationItems = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: Home,
      badge: null,
      roles: ['admin', 'manager']
    },
    {
      label: 'Monitoring',
      href: '/admin/monitoring',
      icon: Activity,
      badge: 'Live',
      roles: ['admin', 'manager', 'analyst']
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      badge: null,
      roles: ['admin', 'manager', 'analyst']
    },
    {
      label: 'User Management',
      href: '/admin/users',
      icon: Users,
      badge: null,
      roles: ['admin', 'manager']
    },
    {
      label: 'AI Models',
      href: '/admin/ai-models',
      icon: Brain,
      badge: null,
      roles: ['admin', 'manager', 'analyst']
    },
    {
      label: 'Database',
      href: '/admin/database',
      icon: Database,
      badge: null,
      roles: ['admin']
    },
    {
      label: 'Security',
      href: '/admin/security',
      icon: Shield,
      badge: null,
      roles: ['admin']
    },
    {
      label: 'System Settings',
      href: '/admin/settings',
      icon: Settings,
      badge: null,
      roles: ['admin', 'manager']
    }
  ]

  const visibleItems = navigationItems.filter(item => item.roles.includes(userRole))

  return (
    <div className={cn(
      'bg-gray-900 border-r border-gray-700 transition-all duration-300',
      isCollapsed ? 'w-16' : 'w-64'
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div>
                <h2 className="text-xl font-bold text-white">Admin Panel</h2>
                <p className="text-sm text-gray-400 capitalize">{userRole}</p>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-400 hover:text-white"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {visibleItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link key={index} href={item.href}>
                <div className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  'hover:bg-gray-800',
                  isActive ? 'bg-ascendia-accent/20 text-ascendia-accent border border-ascendia-accent/30' : 'text-gray-300'
                )}>
                  <Icon className="w-5 h-5 flex-shrink-0" />

                  {!isCollapsed && (
                    <>
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant="outline"
                          size="sm"
                          className="ml-auto text-xs text-green-400 border-green-400/50"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Quick Stats */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-700">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">Quick Stats</h3>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-gray-800 rounded">
                  <p className="text-gray-400">System Health</p>
                  <p className="text-green-400 font-medium">94.5%</p>
                </div>

                <div className="p-2 bg-gray-800 rounded">
                  <p className="text-gray-400">Active Users</p>
                  <p className="text-white font-medium">342</p>
                </div>

                <div className="p-2 bg-gray-800 rounded">
                  <p className="text-gray-400">Alerts</p>
                  <p className="text-orange-400 font-medium">2</p>
                </div>

                <div className="p-2 bg-gray-800 rounded">
                  <p className="text-gray-400">Uptime</p>
                  <p className="text-green-400 font-medium">99.9%</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                asChild
              >
                <Link href="/admin/monitoring">
                  <TrendingUp className="w-3 h-3 mr-2" />
                  View Details
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          {!isCollapsed ? (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <Link href="/dashboard">
                  Back to App
                </Link>
              </Button>

              <div className="text-xs text-gray-400 text-center">
                Ascendia Admin v1.0
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full p-2"
              asChild
            >
              <Link href="/dashboard">
                <Home className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}