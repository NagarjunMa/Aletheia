'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAletheiaStore } from '@/lib/stores/aletheia-chat-store'

export function ThreadSidebar() {
  const {
    threads,
    folders,
    activeThreadId,
    isSidebarOpen,
    setActiveThreadId,
    createNewThread,
    toggleFolder,
    setThreadToAssign,
    setIsSidebarOpen
  } = useAletheiaStore()

  // Spring configuration for smoother animations
  const springConfig = {
    type: "spring",
    damping: 25,
    stiffness: 150,
    mass: 0.8
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[19] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 'auto' : 0,
          x: isSidebarOpen ? 0 : -340
        }}
        transition={springConfig}
        className="fixed lg:relative h-full w-full sm:w-[280px] lg:w-[340px] glass border-r border-aletheia2-glass-border flex flex-col z-20 overflow-hidden shadow-2xl"
        style={{ willChange: 'transform, width' }}
    >
      <div className="p-10 pb-6 flex items-center justify-between">
        <motion.h1
          animate={{ opacity: isSidebarOpen ? 1 : 0 }}
          className="text-xl font-medium tracking-[0.6em] text-aletheia2-accent uppercase"
        >
          Ascendia
        </motion.h1>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="text-aletheia2-accent/40 hover:text-aletheia2-accent transition-colors p-2"
        >
          <i className="fas fa-bars-staggered text-sm"></i>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-8 space-y-10 aletheia-scrollbar pt-4">
        {/* Active Threads Section */}
        <div className="space-y-6">
          <div className="text-[11px] uppercase tracking-[0.5em] text-aletheia2-accent/40 px-2 font-bold flex items-center gap-3">
            <span className="w-2 h-[1px] bg-aletheia2-accent/20"></span>
            Active Conversations
          </div>
          <div className="space-y-2">
            {threads.map(t => (
              <div key={t.id} className="group relative">
                <button
                  onClick={() => setActiveThreadId(t.id)}
                  className={`w-full text-left py-4 px-5 rounded-2xl transition-all flex items-center justify-between border ${
                    activeThreadId === t.id
                      ? 'bg-aletheia2-accent/15 border-aletheia2-accent/30 text-aletheia2-text shadow-[0_0_20px_rgba(109,169,210,0.1)]'
                      : 'border-transparent text-aletheia2-text-dim hover:bg-aletheia2-accent/5'
                  }`}
                >
                  <span className="text-[16px] font-medium truncate pr-4">{t.name}</span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setThreadToAssign(t.id)
                    }}
                    className="opacity-20 group-hover:opacity-100 p-2 hover:text-aletheia2-accent transition-all cursor-pointer flex items-center gap-2 text-[8px] uppercase tracking-widest font-black"
                  >
                    Archive <i className="fas fa-archive"></i>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-6">
          <div className="text-[11px] uppercase tracking-[0.5em] text-aletheia2-accent/40 px-2 font-bold flex items-center gap-3">
            <span className="w-2 h-[1px] bg-aletheia2-accent/20"></span>
            Archives
          </div>
          <div className="space-y-4">
            {folders.map(folder => (
              <div key={folder.id}>
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="w-full flex items-center gap-4 py-4 px-4 hover:bg-aletheia2-accent/10 rounded-2xl transition-all group border border-transparent hover:border-aletheia2-accent/20"
                >
                  <motion.i
                    animate={{ rotate: folder.isOpen ? 90 : 0 }}
                    className="fas fa-chevron-right text-sm text-aletheia2-accent/60 group-hover:text-aletheia2-accent"
                  />
                  <span className="text-[17px] font-bold tracking-tight text-aletheia2-text group-hover:text-aletheia2-accent">
                    {folder.name}
                  </span>
                </button>

                <AnimatePresence>
                  {folder.isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-10 mt-2 space-y-3 border-l-2 border-aletheia2-accent/10 ml-5"
                    >
                      {folder.files.map(file => (
                        <button
                          key={file.id}
                          className="w-full text-left text-[14px] py-2.5 px-3 text-aletheia2-text-dim hover:text-aletheia2-accent hover:bg-aletheia2-accent/5 rounded-xl transition-all flex items-center gap-3 group/file"
                        >
                          <i className="far fa-file-alt text-xs text-aletheia2-accent/30 group-hover/file:text-aletheia2-accent"></i>
                          {file.name}
                        </button>
                      ))}
                      {folder.files.length === 0 && (
                        <div className="text-[12px] text-aletheia2-text-faint italic px-3 py-2">
                          No archived conversations
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="p-10 border-t border-aletheia2-glass-border bg-black/40">
        <button
          onClick={createNewThread}
          className="w-full py-5 text-xs font-bold uppercase tracking-[0.3em] border border-aletheia2-accent/30 rounded-3xl hover:bg-aletheia2-accent hover:text-black hover:border-transparent transition-all duration-500 shadow-2xl flex items-center justify-center gap-3"
        >
          <i className="fas fa-plus text-sm"></i>
          New Conversation
        </button>
      </div>
    </motion.aside>
    </>
  )
}