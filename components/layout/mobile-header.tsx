'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical,
  User,
  Settings,
  LogOut,
  Activity,
  Bell,
  Zap
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'
import { MobileSidebar } from './mobile-sidebar'
import { useAuth, useAuthActions } from '@/lib/stores/auth-store'
import { useStreamingStatus } from '@/lib/stores/streaming-store'

interface MobileHeaderProps {
  title?: string
  subtitle?: string
  className?: string
}

export function MobileHeader({
  title = 'Ascendia',
  subtitle,
  className
}: MobileHeaderProps) {
  const { user } = useAuth()
  const { signOut } = useAuthActions()
  const { sessionCount, isConnected } = useStreamingStatus()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <header className={cn(
      'sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm',
      className
    )}>
      <div className="flex h-16 items-center justify-between px-4">
        {/* Left side - Sidebar toggle + Title */}
        <div className="flex items-center gap-3">
          <MobileSidebar />
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <Logo size="sm" showText={false} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Status + User menu */}
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div className="hidden sm:flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <Badge
              variant={isConnected ? 'default' : 'secondary'}
              className="text-xs"
            >
              {isConnected ? 'Connected' : 'Offline'}
            </Badge>
          </div>

          {/* Active Sessions */}
          {sessionCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {sessionCount}
            </Badge>
          )}

          {/* Notifications - placeholder */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
          </Button>

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">
                      {user.email?.[0].toUpperCase()}
                    </span>
                  </div>
                  <MoreVertical className="h-4 w-4 sm:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm">Sign In</Button>
          )}
        </div>
      </div>

      {/* Mobile connection status */}
      <div className="sm:hidden px-4 pb-2">
        <div className="flex items-center gap-2 text-xs">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          )} />
          <span className="text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {sessionCount > 0 && (
            <span className="text-muted-foreground">
              • {sessionCount} active session{sessionCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}