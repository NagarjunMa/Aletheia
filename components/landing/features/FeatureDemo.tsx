'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface FeatureDemoProps {
  type: 'voice-learning' | 'dual-draft' | 'real-time' | 'progressive'
}

export function FeatureDemo({ type }: FeatureDemoProps) {
  switch (type) {
    case 'voice-learning':
      return (
        <div className="space-y-2 text-xs p-3 bg-[#2e5797]/5 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Analyzing writing patterns...</span>
          </div>
          <div className="bg-background/50 rounded p-2 font-mono text-[10px]">
            Voice Profile: Professional, Concise<br/>
            Tone: 85% Formal, 15% Conversational<br/>
            Complexity: Advanced
          </div>
        </div>
      )

    case 'dual-draft':
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border">
            <div className="text-red-600 dark:text-red-400 text-[10px] font-medium">Grammar Only</div>
            <div className="text-[9px] mt-1">Basic corrections</div>
          </div>
          <div className="bg-[#2e5797]/10 p-2 rounded border border-[#2e5797]/30">
            <div className="text-[#2e5797] text-[10px] font-medium">Style Enhanced</div>
            <div className="text-[9px] mt-1">Your voice + polish</div>
          </div>
        </div>
      )

    case 'real-time':
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-3 h-3 border-2 border-[#2e5797] border-t-transparent rounded-full"
            />
            <span>Streaming improvements...</span>
          </div>
          <div className="bg-gradient-to-r from-[#2e5797]/20 to-transparent p-2 rounded">
            <div className="text-[10px]">
              Response time: <span className="text-[#2e5797] font-mono">847ms</span>
            </div>
          </div>
        </div>
      )

    case 'progressive':
      return (
        <div className="space-y-2 text-xs">
          {["Week 1", "Week 2", "Week 3"].map((week, i) => (
            <div key={week} className="flex items-center gap-2">
              <div className="text-[10px] w-12">{week}:</div>
              <div className="flex-1 bg-muted rounded-full h-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(i + 1) * 30}%` }}
                  transition={{ delay: i * 0.2, duration: 0.8 }}
                  className="bg-[#2e5797] h-1.5 rounded-full"
                />
              </div>
              <div className="text-[10px] text-[#2e5797]">{(i + 1) * 30}%</div>
            </div>
          ))}
        </div>
      )

    default:
      return <div className="text-xs text-muted-foreground">Demo coming soon...</div>
  }
}