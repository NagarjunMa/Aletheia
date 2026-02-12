import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import the core chat interface for better performance
const ChatInterface = dynamic(
  () => import('@/components/chat/chat-interface').then(mod => mod.ChatInterface),
  {
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#6da9d2]/30 border-t-[#6da9d2] rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-[#F0EEE9]/50 text-sm uppercase tracking-widest">Initializing Ascendia...</p>
        </div>
      </div>
    ),
    ssr: false
  }
)

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  return (
    <div className="h-screen bg-black text-white">
      <ChatInterface />
    </div>
  )
}