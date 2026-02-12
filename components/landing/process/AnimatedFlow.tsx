'use client'

import React, { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Upload,
  Search,
  Brain,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Clock,
  Zap,
  FileText,
  Settings,
  Play
} from 'lucide-react'

interface ProcessStep {
  id: number
  icon: React.ElementType
  title: string
  description: string
  details: string[]
  demoComponent: React.ReactNode
  color: string
  time: string
}

const processSteps: ProcessStep[] = [
  {
    id: 1,
    icon: Upload,
    title: "Upload Content",
    description: "Paste, type, or upload your writing in any format—from emails to essays",
    details: [
      "Supports text, documents, and URLs",
      "Real-time content analysis",
      "Automatic format detection",
      "Secure processing"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>Detecting content type...</span>
        </div>
        <div className="bg-muted rounded p-2 font-mono text-[10px]">
          Content: Email Draft (247 words)<br/>
          Format: Plain Text<br/>
          Language: English
        </div>
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-3 w-3" />
          <span>Ready for analysis</span>
        </div>
      </div>
    ),
    color: "#2e5797",
    time: "< 1s"
  },
  {
    id: 2,
    icon: Search,
    title: "AI Analysis",
    description: "Our AI analyzes your content for style, tone, grammar, and improvement opportunities",
    details: [
      "Grammar and syntax checking",
      "Style pattern recognition",
      "Tone analysis",
      "Context understanding"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Grammar Analysis</span>
            <span className="text-[#2e5797]">98%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "98%" }}
              transition={{ duration: 1, delay: 0.5 }}
              className="bg-[#2e5797] h-1 rounded-full"
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Style Recognition</span>
            <span className="text-[#2e5797]">87%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "87%" }}
              transition={{ duration: 1, delay: 0.8 }}
              className="bg-[#4a7bc8] h-1 rounded-full"
            />
          </div>
        </div>
      </div>
    ),
    color: "#4a7bc8",
    time: "2-3s"
  },
  {
    id: 3,
    icon: Brain,
    title: "Voice Learning",
    description: "AI adapts to your unique writing style using our Content Polish Level (CPL) system",
    details: [
      "Personal voice modeling",
      "Style preference learning",
      "Tone consistency tracking",
      "Continuous improvement"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#2e5797]/10 rounded p-2">
            <div className="text-[10px] font-medium">Voice Profile</div>
            <div className="text-[9px] mt-1">Professional, Clear</div>
          </div>
          <div className="bg-[#4a7bc8]/10 rounded p-2">
            <div className="text-[10px] font-medium">CPL Score</div>
            <div className="text-[9px] mt-1 text-[#2e5797] font-bold">7.8/10</div>
          </div>
        </div>
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="bg-gradient-to-r from-[#2e5797]/20 to-[#4a7bc8]/20 rounded p-2"
        >
          <div className="text-[10px] text-center">Learning from 127 documents...</div>
        </motion.div>
      </div>
    ),
    color: "#1a3d6b",
    time: "1-2s"
  },
  {
    id: 4,
    icon: Sparkles,
    title: "Content Polish",
    description: "Generate enhanced versions while preserving your authentic voice and style",
    details: [
      "Dual draft generation",
      "Voice preservation",
      "Grammar enhancement",
      "Style optimization"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-[#2e5797]" />
          <span>Generating enhanced versions...</span>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <div className="bg-green-50 dark:bg-green-900/20 rounded p-1 border border-green-200 dark:border-green-800">
            <div className="text-green-600 dark:text-green-400 text-[9px]">✓ Grammar-only fix ready</div>
          </div>
          <div className="bg-[#2e5797]/10 rounded p-1 border border-[#2e5797]/30">
            <div className="text-[#2e5797] text-[9px]">✓ Voice-enhanced version ready</div>
          </div>
        </div>
      </div>
    ),
    color: "#6b8dd6",
    time: "1-3s"
  }
]

interface ProcessStepCardProps {
  step: ProcessStep
  index: number
  isActive: boolean
  isCompleted: boolean
  onClick: () => void
}

function ProcessStepCard({ step, index, isActive, isCompleted, onClick }: ProcessStepCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const Icon = step.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        duration: 0.6,
        delay: index * 0.2,
        type: "spring",
        stiffness: 100
      }}
      className="relative"
    >
      {/* Connection Line */}
      {index < processSteps.length - 1 && (
        <div className="hidden lg:block absolute top-24 left-full w-16 xl:w-24 h-0.5 bg-gradient-to-r from-[#2e5797] to-[#4a7bc8] z-0">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isCompleted ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="w-full h-full bg-gradient-to-r from-[#2e5797] to-[#4a7bc8] origin-left"
          />
          {/* Animated dot */}
          <motion.div
            animate={isCompleted ? {
              x: [0, 64, 0],
            } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 transform -translate-y-1/2 w-2 h-2 bg-[#2e5797] rounded-full"
          />
        </div>
      )}

      <Card
        className={`p-6 cursor-pointer transition-all duration-300 ${
          isActive
            ? 'bg-[#2e5797]/10 border-[#2e5797] shadow-lg shadow-[#2e5797]/25 scale-105'
            : 'bg-card/50 border-[#2e5797]/20 hover:border-[#2e5797]/40'
        }`}
        onClick={onClick}
      >
        {/* Step Number and Icon */}
        <div className="flex items-center gap-4 mb-4">
          <motion.div
            animate={isActive ? {
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center ${
              isCompleted ? 'bg-green-500' : `bg-[${step.color}]`
            }`}
          >
            {isCompleted ? (
              <CheckCircle className="h-8 w-8 text-white" />
            ) : (
              <Icon className="h-8 w-8 text-white" />
            )}

            {/* Step number badge */}
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white dark:bg-background border-2 border-[#2e5797] rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-[#2e5797]">{step.id}</span>
            </div>
          </motion.div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground mb-1">{step.title}</h3>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{step.time}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {step.description}
        </p>

        {/* Demo Section */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-4"
            >
              <div className="border border-[#2e5797]/20 rounded-lg p-3 bg-[#2e5797]/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-[#2e5797] rounded-full animate-pulse"></div>
                  <span className="text-xs text-muted-foreground font-medium">Live Demo</span>
                </div>
                {step.demoComponent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Details */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="overflow-hidden"
            >
              <div className="space-y-2">
                {step.details.map((detail, i) => (
                  <motion.div
                    key={detail}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-2 text-xs"
                  >
                    <CheckCircle className="h-3 w-3 text-[#2e5797] flex-shrink-0" />
                    <span className="text-muted-foreground">{detail}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

export function AnimatedFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const [activeStep, setActiveStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const playAnimation = () => {
    setIsPlaying(true)
    setCompletedSteps([])
    setActiveStep(1)

    // Simulate process flow
    const steps = [1, 2, 3, 4]
    steps.forEach((step, index) => {
      setTimeout(() => {
        setActiveStep(step)
        if (step > 1) {
          setCompletedSteps(prev => [...prev, step - 1])
        }
        if (step === 4) {
          setTimeout(() => {
            setCompletedSteps(prev => [...prev, 4])
            setIsPlaying(false)
          }, 3000)
        }
      }, index * 3000)
    })
  }

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-muted/30 to-transparent">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
            Simple Process
          </Badge>

          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
              How Ascendia Works
            </span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
            From upload to enhanced content in seconds. Experience the seamless AI-powered
            writing enhancement process that preserves your voice while perfecting your message.
          </p>

          {/* Play Animation Button */}
          <Button
            onClick={playAnimation}
            disabled={isPlaying}
            className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-6 py-3 gap-2"
          >
            <Play className="h-4 w-4" />
            {isPlaying ? 'Watch the Process...' : 'See It in Action'}
          </Button>
        </motion.div>

        {/* Process Steps */}
        <div className="grid lg:grid-cols-4 gap-6 lg:gap-8">
          {processSteps.map((step, index) => (
            <ProcessStepCard
              key={step.id}
              step={step}
              index={index}
              isActive={activeStep === step.id}
              isCompleted={completedSteps.includes(step.id)}
              onClick={() => !isPlaying && setActiveStep(step.id)}
            />
          ))}
        </div>

        {/* Bottom Stats */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 grid md:grid-cols-3 gap-8 text-center"
        >
          <div>
            <div className="text-3xl font-bold text-[#2e5797] mb-2">5-8s</div>
            <div className="text-sm text-muted-foreground">Total processing time</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#2e5797] mb-2">99.9%</div>
            <div className="text-sm text-muted-foreground">Voice preservation accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#2e5797] mb-2">2x</div>
            <div className="text-sm text-muted-foreground">Faster than manual editing</div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mt-12"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-8 py-4 text-lg gap-2"
          >
            Try This Process Now
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  )
}