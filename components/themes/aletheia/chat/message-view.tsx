'use client'

import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAletheiaStore } from '@/lib/stores/aletheia-chat-store'

export function MessageView() {
  const { threads, activeThreadId, acceptDraft } = useAletheiaStore()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [displayedChars, setDisplayedChars] = React.useState<Record<string, number>>({})

  const activeThread = threads.find(t => t.id === activeThreadId)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.messages])

  // Typewriter effect for AI messages
  useEffect(() => {
    if (!activeThread) return

    const lastMessage = activeThread.messages[activeThread.messages.length - 1]
    if (lastMessage?.role === 'assistant' && !displayedChars[lastMessage.id]) {
      const text = lastMessage.content
      let charIndex = 0

      const typeInterval = setInterval(() => {
        setDisplayedChars(prev => ({
          ...prev,
          [lastMessage.id]: charIndex + 1
        }))

        charIndex++
        if (charIndex >= text.length) {
          clearInterval(typeInterval)
        }
      }, 15) // 15ms per character for smooth typing

      return () => clearInterval(typeInterval)
    }
  }, [activeThread?.messages, displayedChars])

  if (!activeThread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-aletheia2-text-dim text-center"
        >
          <motion.i
            className="fas fa-comments text-4xl mb-4 text-aletheia2-accent/20"
            animate={{
              rotate: [0, -5, 5, -5, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3
            }}
          />
          <p>No conversation selected</p>
        </motion.div>
      </div>
    )
  }

  // Staggered animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  }

  const messageVariants = {
    hidden: {
      opacity: 0,
      y: 40,
      filter: 'blur(10px)'
    },
    show: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.6,
        ease: [0.25, 0.4, 0.25, 1]
      }
    }
  }

  return (
    <div className="w-full max-w-4xl px-4 sm:px-8 md:px-12 pt-20 sm:pt-28 md:pt-32 pb-32 sm:pb-52 md:pb-72 space-y-16 sm:space-y-24 md:space-y-32">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-16 sm:space-y-24 md:space-y-32"
      >
        {activeThread.messages.map((msg, index) => {
          const isTyping = msg.role === 'assistant' && displayedChars[msg.id] !== undefined
          const displayText = isTyping
            ? msg.content.slice(0, displayedChars[msg.id] || 0)
            : msg.content

          return (
            <motion.div
              key={msg.id}
              variants={messageVariants}
              className="relative group"
              style={{ willChange: 'transform, opacity, filter' }}
            >
              <div className={`flex flex-col ${msg.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                <motion.div
                  initial={{ opacity: 0, x: msg.role === 'assistant' ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className={`text-[10px] sm:text-[11px] uppercase tracking-[0.4em] sm:tracking-[0.5em] mb-4 sm:mb-6 font-black ${msg.role === 'assistant' ? 'text-aletheia2-accent' : 'text-aletheia2-text-faint'
                    }`}
                >
                  {msg.role === 'assistant' ? 'Ascendia AI' : 'You'}
                </motion.div>

                <motion.div
                  className={`relative w-full text-lg sm:text-xl md:text-2xl leading-[1.6] sm:leading-[1.7] md:leading-[1.8] tracking-tight ${msg.role === 'assistant'
                    ? 'text-aletheia2-text'
                    : 'text-aletheia2-text-muted italic font-extralight'
                    }`}
                >
                  {msg.role === 'assistant' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: '100%', opacity: 1 }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 + 0.3 }}
                      className="absolute -left-8 sm:-left-10 md:-left-12 top-0 bottom-0 w-[2px] sm:w-[3px] bg-gradient-to-b from-aletheia2-accent via-aletheia2-accent/20 to-transparent"
                    />
                  )}
                  <span className="relative">
                    {displayText}
                    {isTyping && (
                      <motion.span
                        className="inline-block w-[2px] h-5 sm:h-6 md:h-7 bg-aletheia2-accent ml-1 align-middle"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      />
                    )}
                  </span>
                </motion.div>

                {msg.isDraft && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-14"
                  >
                    <button
                      onClick={() => acceptDraft(msg.content)}
                      className="relative overflow-hidden group/btn px-12 py-5 rounded-full border border-aletheia2-accent/40 text-xs uppercase tracking-[0.4em] text-aletheia2-accent transition-all hover:bg-aletheia2-accent hover:text-black shadow-2xl shadow-aletheia2-accent/10 font-black"
                    >
                      <span className="relative z-10">Review Draft</span>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-10 transition-opacity"></div>
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
        <div ref={chatEndRef} />
      </motion.div>
    </div>
  )
}