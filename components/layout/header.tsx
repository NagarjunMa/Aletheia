'use client'

import * as React from 'react'
import Link from 'next/link'
import { User, Settings, LogOut, Menu, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/design-system'

interface HeaderProps {
  user?: {
    id: string
    email?: string
    name?: string
    avatar_url?: string
    cpl_score?: number
  } | null
  onSignOut?: () => void
  onMenuToggle?: () => void
  className?: string
}

export function Header({ user, onSignOut, onMenuToggle, className }: HeaderProps) {
  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      style={{ height: layout.header.height }}
    >
      <div className="container flex h-full items-center justify-between px-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="hidden font-bold sm:inline-block">
              Ascendia
            </span>
          </Link>

          {/* Navigation links (desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/dashboard"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/conversations"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              Conversations
            </Link>
            <Link
              href="/analytics"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              Analytics
            </Link>
          </nav>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* CPL Score (if user is logged in) */}
          {user && user.cpl_score && (
            <Badge variant="outline" className="hidden sm:flex">
              CPL {user.cpl_score}
            </Badge>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    {user.cpl_score && (
                      <p className="text-xs leading-none text-muted-foreground">
                        CPL Score: {user.cpl_score}/100
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/signin">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}