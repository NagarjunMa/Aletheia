'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAletheiaStore } from '@/lib/stores/aletheia-chat-store'

const springConfig = {
  type: "spring",
  damping: 25,
  stiffness: 150,
  mass: 0.8
}

export function WorkspacePanel() {
  const {
    isWorkspaceOpen,
    setIsWorkspaceOpen,
    activeDraft,
    activeThreadId
  } = useAletheiaStore()

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isWorkspaceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsWorkspaceOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-39 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Workspace panel */}
      <AnimatePresence>
        {isWorkspaceOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={springConfig}
            className="fixed inset-y-0 right-0 w-full sm:w-[85%] md:w-[70%] lg:w-[55%] xl:w-[48%] bg-aletheia2-bg-dark border-l border-aletheia2-glass-border z-40 flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.8)] sm:shadow-[-30px_0_90px_rgba(0,0,0,0.9)] lg:shadow-[-40px_0_120px_rgba(0,0,0,1)]"
            style={{ willChange: 'transform' }}
          >
            <div className="p-6 sm:p-8 md:p-10 lg:p-12 border-b border-aletheia2-glass-border bg-black/40 backdrop-blur-2xl flex items-center justify-between">
              <div className="flex flex-col gap-2 sm:gap-3">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] sm:text-xs uppercase tracking-[0.5em] sm:tracking-[0.6em] text-aletheia2-accent font-black"
                >
                  Draft Review
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs sm:text-sm font-medium tracking-wider sm:tracking-widest text-aletheia2-text-muted italic"
                >
                  Review your refined content
                </motion.h2>
              </div>
              <motion.button
                onClick={() => setIsWorkspaceOpen(false)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 transition-all text-aletheia2-text-dim border border-transparent hover:border-red-500/30"
              >
                <i className="fas fa-times text-lg sm:text-xl lg:text-2xl"></i>
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 sm:p-16 md:p-20 lg:p-24 xl:p-40 selection:bg-aletheia2-accent/50 aletheia-scrollbar">
              <motion.div
                initial={{ opacity: 0, scale: 0.99, filter: 'blur(30px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                className="max-w-4xl mx-auto editor-serif"
            >
              <div className="mb-32 text-center opacity-10 italic font-extralight text-sm tracking-[0.8em] uppercase">
                /// Refined Content ///
              </div>

              <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-[2] sm:leading-[2.2] md:leading-[2.4] lg:leading-[2.6] text-aletheia2-text-muted font-light first-letter:text-6xl sm:first-letter:text-7xl md:first-letter:text-8xl lg:first-letter:text-9xl first-letter:text-aletheia2-accent first-letter:mr-4 sm:first-letter:mr-6 lg:first-letter:mr-8 first-letter:float-left first-letter:font-serif first-letter:font-black">
                {activeDraft ? (
                  activeDraft.split('\n').map((para, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: i * 0.1,
                        duration: 0.8,
                        ease: [0.25, 0.4, 0.25, 1]
                      }}
                      className="mb-12 sm:mb-16 lg:mb-20"
                    >
                      {para}
                    </motion.p>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.1 }}
                    className="text-center italic py-20 sm:py-40 lg:py-60"
                  >
                    No draft selected for review.
                  </motion.div>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ delay: 1 }}
                className="mt-20 sm:mt-40 lg:mt-60 w-full flex flex-col items-center gap-6 sm:gap-10 lg:gap-12"
              >
                <div className="w-px h-24 sm:h-36 lg:h-48 bg-gradient-to-b from-aletheia2-accent to-transparent"></div>
                <div className="text-[10px] sm:text-[11px] lg:text-[12px] uppercase tracking-[1em] sm:tracking-[1.2em] lg:tracking-[1.5em]">End of Draft</div>
              </motion.div>
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    </>
  )
}