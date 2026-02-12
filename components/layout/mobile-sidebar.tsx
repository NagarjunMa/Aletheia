'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Menu,
  Home,
  Edit3,
  BarChart3,
  Settings,
  User,
  FileText,
  Zap,
  Activity
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/stores/auth-store'
import { useStreamingStatus } from '@/lib/stores/streaming-store'
import { Badge } from '@/components/ui/badge'

interface MobileSidebarProps {
  className?: string
}

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
  badge?: string | number
  active?: boolean
}

export function MobileSidebar({ className }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const { user, profile } = useAuth()
  const { sessionCount, isConnected } = useStreamingStatus()

  const navigationItems: SidebarItem[] = [
    {
      icon: Home,
      label: 'Dashboard',
      href: '/',
      active: true
    },
    {
      icon: Edit3,
      label: 'Editor',
      href: '/editor'
    },
    {
      icon: Zap,
      label: 'Streaming',
      href: '/streaming',
      badge: sessionCount > 0 ? sessionCount : undefined
    },
    {
      icon: FileText,
      label: 'Conversations',
      href: '/conversations'
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      href: '/analytics'
    },
    {
      icon: Activity,
      label: 'History',
      href: '/history'
    }
  ]

  const accountItems: SidebarItem[] = [
    {
      icon: User,
      label: 'Profile',
      href: '/profile'
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/settings'
    }
  ]

  const handleItemClick = (item: SidebarItem) => {
    if (item.onClick) {
      item.onClick()
    }
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('md:hidden', className)}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-6 pb-4">
            <Logo size="lg" className="justify-start" />
            <p className="text-sm text-muted-foreground mt-2">AI Writing Assistant</p>
          </SheetHeader>

          {/* Connection Status */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {sessionCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {sessionCount} active
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Navigation */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6">
              {/* Main Navigation */}
              <div>
                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Navigation
                </h3>
                <div className="space-y-1">
                  {navigationItems.map((item) => (
                    <Button
                      key={item.label}
                      variant={item.active ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => handleItemClick(item)}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.label}
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Account */}
              <div>
                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Account
                </h3>
                <div className="space-y-1">
                  {accountItems.map((item) => (
                    <Button
                      key={item.label}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleItemClick(item)}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* User Info */}
          {user && (
            <>
              <Separator />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">
                      {user.email?.[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.user_metadata?.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                {profile?.current_cpl && (
                  <div className="mt-3 flex items-center gap-2">
                    <BarChart3 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      CPL: {profile.current_cpl}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}