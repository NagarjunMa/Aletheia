'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TypewriterTextProps {
  text: string
  isStreaming?: boolean
  speed?: number
  showCursor?: boolean
  onComplete?: () => void
  className?: string
}

export function TypewriterText({
  text,
  isStreaming = false,
  speed = 30,
  showCursor = true,
  onComplete,
  className = ''
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (currentIndex < text.length) {
      timeoutRef.current = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1))
        setCurrentIndex(currentIndex + 1)
      }, speed)
    } else if (!isComplete) {
      setIsComplete(true)
      onComplete?.()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [currentIndex, text, speed, onComplete, isComplete])

  // Reset when text changes (new streaming content)
  useEffect(() => {
    setCurrentIndex(0)
    setDisplayedText('')
    setIsComplete(false)
  }, [text])

  const cursorVariants = {
    visible: { opacity: 1 },
    hidden: { opacity: 0 }
  }

  return (
    <span className={className}>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {displayedText}
      </motion.span>

      <AnimatePresence>
        {showCursor && (isStreaming || !isComplete) && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-aletheia-gold ml-0.5"
            variants={cursorVariants}
            initial="visible"
            animate="visible"
            exit="hidden"
            transition={{
              duration: 0.8,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
          />
        )}
      </AnimatePresence>
    </span>
  )
}

interface StreamingMessageProps {
  content: string
  isStreaming: boolean
  onStreamComplete?: () => void
  className?: string
}

export function StreamingMessage({
  content,
  isStreaming,
  onStreamComplete,
  className = ''
}: StreamingMessageProps) {
  const [words, setWords] = useState<string[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)

  useEffect(() => {
    const wordArray = content.split(' ')
    setWords(wordArray)

    if (!isStreaming) {
      setCurrentWordIndex(wordArray.length)
      onStreamComplete?.()
    }
  }, [content, isStreaming, onStreamComplete])

  useEffect(() => {
    if (isStreaming && currentWordIndex < words.length) {
      const timer = setTimeout(() => {
        setCurrentWordIndex(prev => prev + 1)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [currentWordIndex, words.length, isStreaming])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  }

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 10,
      filter: 'blur(4px)'
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.3,
        ease: [0.25, 1, 0.5, 1]
      }
    }
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {words.slice(0, currentWordIndex).map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={wordVariants}
          className="inline-block mr-1"
        >
          {word}
        </motion.span>
      ))}

      {isStreaming && currentWordIndex < words.length && (
        <motion.span
          className="inline-block w-0.5 h-4 bg-aletheia-gold ml-1"
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </motion.div>
  )
}