'use client'

import React, { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  Sparkles,
  Zap,
  Brain,
  Wand2,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Clock,
  Shield
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { FeatureDemo } from './FeatureDemo'

interface Feature {
  icon: React.ElementType
  title: string
  description: string
  benefits: string[]
  demoComponent: React.ReactNode
  color: string
  stats: { value: string; label: string }
}

const features: Feature[] = [
  {
    icon: Brain,
    title: "AI Voice Learning",
    description: "Ascendia adapts to your unique writing style using our proprietary Content Polish Level (CPL) system",
    benefits: [
      "Learns your tone and voice patterns",
      "Adapts to industry-specific terminology",
      "Preserves your authentic style",
      "Improves with each interaction"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>Analyzing writing patterns...</span>
        </div>
        <div className="bg-[#2e5797]/10 rounded p-2">
          <div className="font-mono text-[10px]">
            Voice Profile: Professional, Concise<br/>
            Tone Preference: 85% Formal<br/>
            Complexity Level: Advanced
          </div>
        </div>
      </div>
    ),
    color: "#2e5797",
    stats: { value: "95%", label: "Voice accuracy" }
  },
  {
    icon: Sparkles,
    title: "Dual Draft Generation",
    description: "Get two versions: grammar-fix only and adaptive polish that matches your unique writing style",
    benefits: [
      "Quick grammar corrections",
      "Style-enhanced versions",
      "Compare before & after",
      "Choose your preference"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
            <div className="text-red-600 dark:text-red-400 text-[10px] font-medium">Grammar Only</div>
            <div className="text-[9px] mt-1">Basic corrections</div>
          </div>
          <div className="bg-[#2e5797]/10 p-2 rounded border border-[#2e5797]/30">
            <div className="text-[#2e5797] text-[10px] font-medium">Style Enhanced</div>
            <div className="text-[9px] mt-1">Your voice + polish</div>
          </div>
        </div>
      </div>
    ),
    color: "#4a7bc8",
    stats: { value: "2x", label: "Faster editing" }
  },
  {
    icon: Zap,
    title: "Real-time Streaming",
    description: "Watch your content improve in real-time with our streaming AI technology—no waiting required",
    benefits: [
      "Instant feedback as you type",
      "Live content enhancement",
      "No processing delays",
      "Seamless user experience"
    ],
    demoComponent: (
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
            Processing: <span className="text-[#2e5797] font-mono">847ms</span>
          </div>
        </div>
      </div>
    ),
    color: "#1a3d6b",
    stats: { value: "< 1s", label: "Response time" }
  },
  {
    icon: TrendingUp,
    title: "Progressive Learning",
    description: "AI that gets smarter with every document, building a comprehensive understanding of your preferences",
    benefits: [
      "Continuous improvement",
      "Document history analysis",
      "Preference tracking",
      "Personalized suggestions"
    ],
    demoComponent: (
      <div className="space-y-2 text-xs">
        <div className="space-y-1">
          {["Week 1", "Week 2", "Week 3"].map((week, i) => (
            <div key={week} className="flex items-center gap-2">
              <div className="text-[10px] w-12">{week}:</div>
              <div className="flex-1 bg-muted rounded-full h-1.5">
                <div
                  className="bg-[#2e5797] h-1.5 rounded-full"
                  style={{ width: `${(i + 1) * 30}%` }}
                />
              </div>
              <div className="text-[10px] text-[#2e5797]">{(i + 1) * 30}%</div>
            </div>
          ))}
        </div>
      </div>
    ),
    color: "#6b8dd6",
    stats: { value: "300%", label: "Learning rate" }
  }
]

interface FeatureCardProps {
  feature: Feature
  index: number
}

function FeatureCard({ feature, index }: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const Icon = feature.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 100, rotateX: -15 }}
      animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{
        duration: 0.8,
        delay: index * 0.2,
        type: "spring",
        stiffness: 100
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ perspective: "1000px" }}
      className="group"
    >
      <motion.div
        animate={{
          rotateX: isHovered ? 5 : 0,
          rotateY: isHovered ? 5 : 0,
          z: isHovered ? 50 : 0,
          scale: isHovered ? 1.02 : 1
        }}
        transition={{ duration: 0.3 }}
        className="relative h-full"
      >
        <Card className="p-8 h-full bg-card/50 backdrop-blur-sm border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 overflow-hidden">
          {/* Glowing effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-[#2e5797]/10 to-transparent rounded-lg"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Floating particles */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-[#2e5797]/60 rounded-full"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${15 + i * 10}%`,
                }}
                animate={{
                  y: isHovered ? [0, -20, 0] : 0,
                  opacity: isHovered ? [0.6, 1, 0.6] : 0
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </motion.div>

          {/* Header */}
          <div className="relative z-10">
            <motion.div
              animate={{
                scale: isHovered ? 1.1 : 1,
                rotate: isHovered ? 5 : 0
              }}
              className="text-[#2e5797] mb-6 inline-block"
            >
              <Icon size={48} />
            </motion.div>

            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-bold text-foreground group-hover:text-[#2e5797] transition-colors">
                {feature.title}
              </h3>
              <Badge
                className="bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30 text-xs"
              >
                {feature.stats.value}
              </Badge>
            </div>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {feature.description}
            </p>
          </div>

          {/* Demo Section */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: isHovered ? "auto" : 0,
              opacity: isHovered ? 1 : 0
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-6"
          >
            <div className="border border-[#2e5797]/20 rounded-lg p-4 bg-[#2e5797]/5">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-[#2e5797] rounded-full animate-pulse"></div>
                Live Demo
              </div>
              {feature.demoComponent}
            </div>
          </motion.div>

          {/* Benefits List */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: isExpanded ? "auto" : 0,
              opacity: isExpanded ? 1 : 0
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 mb-6">
              {feature.benefits.map((benefit, i) => (
                <motion.div
                  key={benefit}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-sm"
                >
                  <CheckCircle className="h-4 w-4 text-[#2e5797] flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-4">
            <div className="text-xs text-muted-foreground">
              {feature.stats.label}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#2e5797] hover:text-[#1a3d6b] hover:bg-[#2e5797]/10"
            >
              {isExpanded ? "Show Less" : "Learn More"}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
              </motion.div>
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export function InteractiveFeatures() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-transparent to-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
            Powerful Features
          </Badge>

          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
              How Ascendia Works
            </span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Experience the power of AI that understands your unique voice and writing style,
            delivering personalized improvements that preserve your authenticity.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mt-16"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-8 py-4 text-lg gap-2"
          >
            Try These Features Now
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  )
}