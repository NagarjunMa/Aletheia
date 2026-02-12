'use client'

import React, { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAletheiaStore } from '@/lib/stores/aletheia-chat-store'
import { NeuralGlow } from './neural-glow'

export function NeuralInput() {
  const { input, isProcessing, setInput, sendMessage } = useAletheiaStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!input.trim() || isProcessing) return
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 100
      }}
      className="fixed bottom-4 sm:bottom-8 md:bottom-16 w-[calc(100%-2rem)] sm:w-full max-w-xl sm:max-w-2xl px-4 sm:px-8 z-20 left-1/2 transform -translate-x-1/2"
    >
      <div className="relative">
        <AnimatePresence>
          {isProcessing && <NeuralGlow />}
        </AnimatePresence>

        {/* Neural rotating border effect when processing */}
        {isProcessing && (
          <motion.div
            className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, transparent, #6da9d2, transparent, #6da9d2, transparent)',
              filter: 'blur(20px)',
              willChange: 'transform'
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        )}

        <motion.div
          animate={{
            scale: isProcessing ? 1.02 : 1
          }}
          transition={{
            type: "spring",
            damping: 15,
            stiffness: 200
          }}
          className={`neural-border relative rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] bg-aletheia2-bg-dark/95 backdrop-blur-3xl p-1 sm:p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] sm:shadow-[0_30px_70px_rgba(0,0,0,0.9)] md:shadow-[0_40px_80px_rgba(0,0,0,1)] transition-all duration-700 ${
            isProcessing ? 'is-processing ring-2 ring-aletheia2-accent/50' : 'border border-aletheia2-glass-border'
          }`}
        >
          <div className="relative bg-aletheia2-bg rounded-[1.3rem] sm:rounded-[1.8rem] md:rounded-[2.3rem] flex items-center overflow-hidden">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to write?"
              className="w-full bg-transparent py-4 sm:py-6 md:py-7 px-6 sm:px-8 md:px-10 text-aletheia2-text placeholder:text-aletheia2-text-faint focus:outline-none resize-none font-light text-base sm:text-lg md:text-xl max-h-[120px] sm:max-h-[160px] md:max-h-[200px] aletheia-scrollbar"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
            <motion.button
              onClick={handleSend}
              disabled={isProcessing || !input.trim()}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              animate={{
                rotate: isProcessing ? 360 : 0
              }}
              transition={{
                rotate: {
                  duration: 1,
                  repeat: isProcessing ? Infinity : 0,
                  ease: "linear"
                }
              }}
              className="mx-4 sm:mx-6 md:mx-8 p-3 sm:p-4 md:p-5 rounded-full text-aletheia2-accent disabled:opacity-10 transition-all bg-aletheia2-accent/5 border border-aletheia2-accent/30 hover:bg-aletheia2-accent/20 hover:border-aletheia2-accent/50"
            >
              {isProcessing ? (
                <i className="fas fa-circle-notch text-sm sm:text-base"></i>
              ) : (
                <i className="fas fa-chevron-right text-sm sm:text-base"></i>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Typing indicator dots */}
        {input.length > 0 && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex gap-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-1 bg-aletheia2-accent/50 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}