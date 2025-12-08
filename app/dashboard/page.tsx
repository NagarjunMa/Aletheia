import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ChatInterface } from '@/components/chat/chat-interface'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col">
        <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold">Chat with Ascendia</h1>
            <p className="text-muted-foreground">
              Start writing and let Ascendia adapt to your unique voice
            </p>
          </div>
        </div>
        <div className="flex-1 container mx-auto px-6 py-6">
          <ChatInterface />
        </div>
      </div>
    </DashboardLayout>
  )
}