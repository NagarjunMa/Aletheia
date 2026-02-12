'use client'

import * as React from 'react'
import Link from 'next/link'
import { User, Settings, LogOut, Menu } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

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
        'sticky top-0 z-50 w-full bg-ascendia-black text-white',
        className
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        {/* Left section */}
        <div className="flex items-center gap-8">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="md:hidden text-white hover:bg-ascendia-gray"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>

          {/* Logo - Ascendia */}
          <Link href="/" className="flex items-center text-white hover:text-ascendia-accent transition-colors">
            <Logo size="md" className="text-white" />
          </Link>

          {/* Navigation links (desktop) - section navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a
              href="#home"
              className="text-white hover:text-ascendia-accent transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Home
            </a>
            <a
              href="#how-it-works"
              className="text-white hover:text-ascendia-accent transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              How It Works
            </a>
            <a
              href="#testimonials"
              className="text-white hover:text-ascendia-accent transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Testimonials
            </a>
            <a
              href="#feedback"
              className="text-white hover:text-ascendia-accent transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Feedback
            </a>
          </nav>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4">
          {/* CPL Score (if user is logged in) */}
          {user && user.cpl_score && (
            <Badge variant="outline" className="hidden sm:flex border-ascendia-accent text-ascendia-accent">
              CPL {user.cpl_score}
            </Badge>
          )}

          {/* User menu or Login button */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-ascendia-gray">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
                    <AvatarFallback className="bg-ascendia-gray text-white">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-ascendia-gray border-ascendia-gray-light" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-white">
                      {user.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-gray-300">
                      {user.email}
                    </p>
                    {user.cpl_score && (
                      <p className="text-xs leading-none text-gray-300">
                        CPL Score: {user.cpl_score}/100
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-ascendia-gray-light" />
                <DropdownMenuItem asChild className="text-white hover:bg-ascendia-gray-light">
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-white hover:bg-ascendia-gray-light">
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-ascendia-gray-light" />
                <DropdownMenuItem onClick={onSignOut} className="text-white hover:bg-ascendia-gray-light">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              className="bg-ascendia-black border border-white text-white hover:bg-ascendia-gray transition-colors px-6"
              variant="outline"
              asChild
            >
              <Link href="/auth/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}