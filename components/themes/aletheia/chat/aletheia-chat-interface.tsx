'use client'

import React, { useEffect } from 'react'
import { useAletheiaStore } from '@/lib/stores/aletheia-chat-store'
import { ThreadSidebar } from './thread-sidebar'
import { MessageView } from './message-view'
import { NeuralInput } from './neural-input'
import { PreservationModal } from './preservation-modal'
import { WorkspacePanel } from './workspace-panel'

export function AletheiaChatInterface() {
  const {
    threads,
    activeThreadId,
    isSidebarOpen,
    setIsSidebarOpen,
    initializeStore
  } = useAletheiaStore()

  // Initialize the store with a default thread
  useEffect(() => {
    if (threads.length === 0) {
      initializeStore()
    }
  }, [threads.length, initializeStore])

  const activeThread = threads.find(t => t.id === activeThreadId)

  return (
    <div className="flex h-screen w-full bg-aletheia2-bg text-aletheia2-text selection:bg-aletheia2-accent/30 overflow-hidden font-light">
      {/* Thread Sidebar */}
      <ThreadSidebar />

      {/* Main Workspace */}
      <main className="flex-1 relative flex flex-col items-center overflow-y-auto aletheia-scrollbar bg-gradient-to-b from-aletheia2-bg-light to-black">
        {/* Navigation Bar */}
        <div className="sticky top-0 w-full z-10 px-12 py-8 flex justify-between items-center bg-black/60 backdrop-blur-xl border-b border-aletheia2-glass-border">
          <div className="flex items-center gap-8">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="text-aletheia2-accent/60 hover:text-aletheia2-accent transition-transform hover:scale-125"
              >
                <i className="fas fa-align-left text-lg"></i>
              </button>
            )}
            <div className="h-6 w-px bg-aletheia2-accent/20"></div>
            <div className="text-xs uppercase tracking-[0.6em] text-aletheia2-accent/70 font-bold">
              {activeThread?.name || 'No Conversation'}
            </div>
          </div>

          <div className="flex gap-10 items-center">
            <div className="flex gap-3 items-center text-[10px] uppercase tracking-widest text-aletheia2-text-dim font-bold">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse"></span>
              AI Ready
            </div>
            <div className="h-6 w-px bg-aletheia2-accent/20"></div>
            <div className="flex gap-6">
              <i className="fas fa-brain text-[16px] text-aletheia2-accent/40 hover:text-aletheia2-accent transition-colors cursor-pointer" title="AI Intelligence"></i>
              <i className="fas fa-shield-alt text-[16px] text-aletheia2-accent/40 hover:text-aletheia2-accent transition-colors cursor-pointer" title="Content Security"></i>
            </div>
          </div>
        </div>

        {/* Message View */}
        <MessageView />

        {/* Neural Input */}
        <NeuralInput />
      </main>

      {/* Preservation Modal */}
      <PreservationModal />

      {/* Workspace Panel */}
      <WorkspacePanel />

      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] bg-aletheia2-accent/5 blur-[300px] rounded-full"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-aletheia2-accent/3 blur-[250px] rounded-full"></div>
      </div>
    </div>
  )
}