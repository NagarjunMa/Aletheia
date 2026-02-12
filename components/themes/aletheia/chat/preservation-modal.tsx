'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAletheiaStore } from '@/lib/stores/aletheia-chat-store'

export function PreservationModal() {
  const { threadToAssign, folders, setThreadToAssign, assignThreadToCategory } = useAletheiaStore()

  return (
    <AnimatePresence>
      {threadToAssign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass max-w-md w-full rounded-[3rem] p-12 border-aletheia2-glass-border shadow-[0_0_120px_rgba(109,169,210,0.2)] flex flex-col gap-10"
          >
            <div className="text-center space-y-4">
              <div className="text-aletheia2-accent text-3xl mb-2">
                <i className="fas fa-archive"></i>
              </div>
              <h3 className="text-lg uppercase tracking-[0.5em] font-black text-aletheia2-text">
                Archive Conversation
              </h3>
              <p className="text-sm text-aletheia2-text-muted font-light leading-relaxed">
                Save this conversation to an archive folder for future reference.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => assignThreadToCategory(f.id)}
                  className="w-full text-left py-6 px-8 rounded-2xl bg-white/5 border border-white/5 hover:border-aletheia2-accent/60 hover:bg-aletheia2-accent/15 transition-all group flex items-center justify-between"
                >
                  <span className="text-sm font-bold uppercase tracking-[0.2em] text-aletheia2-text">
                    {f.name}
                  </span>
                  <i className="fas fa-chevron-right text-xs opacity-0 group-hover:opacity-100 transition-opacity text-aletheia2-accent"></i>
                </button>
              ))}
            </div>

            <button
              onClick={() => setThreadToAssign(null)}
              className="w-full py-4 text-[10px] uppercase tracking-[0.5em] text-aletheia2-text-faint hover:text-aletheia2-text-muted transition-colors font-black"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}