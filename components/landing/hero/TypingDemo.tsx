'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wand2, Check } from 'lucide-react'

interface DemoContent {
  before: string
  after: string
  improvement: string
}

const demoContents: DemoContent[] = [
  {
    before: "The meeting went really good and we discussed some stuff about the project.",
    after: "The meeting was highly productive, and we thoroughly discussed key project milestones and strategic objectives.",
    improvement: "Enhanced clarity and professionalism"
  },
  {
    before: "I think your idea is pretty nice and might work for our company.",
    after: "I believe your innovative proposal aligns perfectly with our strategic vision and could drive significant value for our organization.",
    improvement: "Improved tone and specificity"
  },
  {
    before: "The report has some issues that need to be fixed before we can submit it.",
    after: "The report requires several strategic revisions to ensure accuracy and compliance before final submission.",
    improvement: "Added precision and professionalism"
  }
]

export function TypingDemo() {
  const [currentDemo, setCurrentDemo] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'processing' | 'revealing'>('typing')
  const [typedText, setTypedText] = useState('')
  const [revealedText, setRevealedText] = useState('')

  useEffect(() => {
    const demo = demoContents[currentDemo]
    let timeoutId: NodeJS.Timeout

    if (phase === 'typing') {
      // Typing animation for original text
      if (typedText.length < demo.before.length) {
        timeoutId = setTimeout(() => {
          setTypedText(demo.before.slice(0, typedText.length + 1))
        }, 50)
      } else {
        // Move to processing phase
        timeoutId = setTimeout(() => {
          setPhase('processing')
        }, 1000)
      }
    } else if (phase === 'processing') {
      // Processing phase
      timeoutId = setTimeout(() => {
        setPhase('revealing')
        setRevealedText('')
      }, 2000)
    } else if (phase === 'revealing') {
      // Revealing improved text
      if (revealedText.length < demo.after.length) {
        timeoutId = setTimeout(() => {
          setRevealedText(demo.after.slice(0, revealedText.length + 1))
        }, 30)
      } else {
        // Reset for next demo
        timeoutId = setTimeout(() => {
          setCurrentDemo((prev) => (prev + 1) % demoContents.length)
          setPhase('typing')
          setTypedText('')
          setRevealedText('')
        }, 3000)
      }
    }

    return () => clearTimeout(timeoutId)
  }, [currentDemo, phase, typedText, revealedText])

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <Badge variant="outline" className="border-[#2e5797]/30 text-[#2e5797]">
          Live AI Enhancement Demo
        </Badge>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Before - Original Text */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border border-red-200/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm font-medium text-muted-foreground">Original Text</span>
          </div>

          <div className="min-h-[100px] font-mono text-sm leading-relaxed">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDemo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-foreground/80"
              >
                {typedText}
                {phase === 'typing' && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block w-0.5 h-4 bg-foreground ml-1"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {phase !== 'typing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span>Needs improvement</span>
            </motion.div>
          )}
        </Card>

        {/* Processing Arrow */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <motion.div
            animate={phase === 'processing' ? {
              scale: [1, 1.2, 1],
              rotate: [0, 360],
            } : {}}
            transition={{ duration: 2, repeat: phase === 'processing' ? Infinity : 0 }}
            className="bg-[#2e5797] p-3 rounded-full shadow-lg shadow-[#2e5797]/25"
          >
            {phase === 'processing' ? (
              <Wand2 className="h-6 w-6 text-white" />
            ) : phase === 'revealing' ? (
              <Check className="h-6 w-6 text-white" />
            ) : (
              <Wand2 className="h-6 w-6 text-white" />
            )}
          </motion.div>
        </div>

        {/* After - Improved Text */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border border-[#2e5797]/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#2e5797]" />
            <span className="text-sm font-medium text-muted-foreground">AI Enhanced</span>
          </div>

          <div className="min-h-[100px] font-mono text-sm leading-relaxed">
            <AnimatePresence mode="wait">
              {phase === 'revealing' && (
                <motion.div
                  key={`${currentDemo}-after`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[#2e5797]"
                >
                  {revealedText}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block w-0.5 h-4 bg-[#2e5797] ml-1"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {phase === 'revealing' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-4"
            >
              <Badge className="bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/20">
                {demoContents[currentDemo].improvement}
              </Badge>
            </motion.div>
          )}
        </Card>
      </div>

      {/* Progress Indicators */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center mt-6 gap-2"
      >
        {demoContents.map((_, index) => (
          <motion.div
            key={index}
            animate={{
              scale: index === currentDemo ? 1.2 : 1,
              backgroundColor: index === currentDemo ? '#2e5797' : 'rgba(46, 87, 151, 0.3)'
            }}
            className="w-2 h-2 rounded-full"
          />
        ))}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 flex justify-center gap-8 text-center"
      >
        <div>
          <div className="text-2xl font-bold text-[#2e5797]">3.2s</div>
          <div className="text-xs text-muted-foreground">Average processing time</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#2e5797]">95%</div>
          <div className="text-xs text-muted-foreground">Accuracy improvement</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[#2e5797]">10x</div>
          <div className="text-xs text-muted-foreground">Faster than manual editing</div>
        </div>
      </motion.div>
    </div>
  )
}