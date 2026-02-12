'use client'

import React from 'react'
import { Header } from './header'
import { ConversationSidebar } from '@/components/sidebar/ConversationSidebar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { setCurrentConversation } = useChatStore()

  // Fixed: Use proper auth integration instead of hardcoded demo user
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
          router.push('/auth/login')
          return
        }

        // Get user profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, cpl_score')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.warn('Profile not found, using auth data only:', profileError)
        }

        setUser({
          id: user.id,
          email: user.email || '',
          name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
          cpl_score: profile?.cpl_score || 50
        })
        setLoading(false)
      } catch (error) {
        console.error('Auth error:', error)
        router.push('/auth/login')
      }
    }

    getUser()
  }, [])

  // COMMENTED OUT - INFINITE LOOP SOURCE:
  /*
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
          router.push('/auth/login')
          return
        }

        // Get user profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.warn('Profile not found, using auth data only:', profileError)
        }

        setUser({
          id: user.id,
          email: user.email,
          name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
          cpl_score: 0 // Default score, will be updated separately if needed
        })
        setLoading(false)
      } catch (error) {
        console.error('Error loading user:', error)
        router.push('/auth/login')
      }
    }

    let mounted = true

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/auth/login')
      } else if (event === 'SIGNED_IN' && session?.user && mounted) {
        // Only reload user data on sign in, not on every auth change
        setLoading(true)
        await getUser()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router])
  */

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-aletheia-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-aletheia-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-aletheia-text">Loading...</p>
        </div>
      </div>
    )
  }

  const handleConversationSelect = (conversationId: string) => {
    // Load the selected conversation
    setCurrentConversation({ id: conversationId } as any)
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="min-h-screen bg-aletheia-bg">
      <div className="flex h-screen">
        <ConversationSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          onConversationSelect={handleConversationSelect}
        />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}