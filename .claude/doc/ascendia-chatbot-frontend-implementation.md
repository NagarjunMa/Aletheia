# Ascendia AI Chatbot Frontend Implementation Plan

## Overview
This document provides a comprehensive implementation plan for redesigning the Ascendia AI application frontend with a professional chatbot interface, black background theme, modern navigation, and interactive elements including a 3D globe animation.

## Current Project Analysis

**Existing Setup:**
- Next.js 14 with App Router
- React 18 with TypeScript
- shadcn/ui components library
- Tailwind CSS for styling
- Framer Motion for animations
- React Three Fiber (@react-three/fiber) and Drei (@react-three/drei) already installed
- Zustand for state management
- TanStack Query for server state

**Key Dependencies Already Available:**
- @react-three/fiber: 8.18.0 (3D rendering)
- @react-three/drei: 9.122.0 (3D helpers)
- @types/three: 0.182.0 (TypeScript types)
- framer-motion: 11.18.2 (animations)

## 1. Design System & Color Scheme

### Primary Color Palette
```typescript
// Custom color tokens for black background theme
const colors = {
  background: {
    primary: '#000000',      // Pure black main background
    secondary: '#0a0a0a',    // Slightly lighter black for cards
    tertiary: '#141414',     // Card hover states
  },
  accent: {
    primary: '#00ff88',      // Bright green accent
    secondary: '#00cc6a',    // Darker green for hover
    tertiary: '#004d26',     // Very dark green for subtle elements
  },
  text: {
    primary: '#ffffff',      // White for main text
    secondary: '#a0a0a0',    // Light gray for secondary text
    muted: '#666666',        // Darker gray for muted text
  },
  border: {
    default: '#333333',      // Dark gray borders
    accent: '#00ff88',       // Green accent borders
    subtle: '#1a1a1a',       // Very subtle borders
  }
}
```

### Tailwind Configuration Updates
```typescript
// Add to tailwind.config.ts
extend: {
  colors: {
    'ascendia-black': '#000000',
    'ascendia-dark': '#0a0a0a',
    'ascendia-darker': '#141414',
    'ascendia-green': '#00ff88',
    'ascendia-green-dark': '#00cc6a',
    'ascendia-green-darker': '#004d26',
    'ascendia-gray': '#a0a0a0',
    'ascendia-gray-dark': '#666666',
    'ascendia-border': '#333333',
    'ascendia-border-subtle': '#1a1a1a',
  },
  animation: {
    'float': 'float 6s ease-in-out infinite',
    'rotate-slow': 'rotate 20s linear infinite',
    'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
    'binary-rain': 'binary-rain 3s linear infinite',
  },
  keyframes: {
    float: {
      '0%, 100%': { transform: 'translateY(0px)' },
      '50%': { transform: 'translateY(-10px)' },
    },
    'glow-pulse': {
      '0%, 100%': {
        boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)'
      },
      '50%': {
        boxShadow: '0 0 40px rgba(0, 255, 136, 0.6)'
      },
    },
    'binary-rain': {
      '0%': { transform: 'translateY(-100vh)' },
      '100%': { transform: 'translateY(100vh)' },
    },
  },
}
```

## 2. Component Architecture

### Page Structure
```
app/
├── page.tsx (New Landing Page)
├── layout.tsx (Updated with black theme)
├── globals.css (Updated with black theme variables)
└── chat/
    └── page.tsx (Main chat interface)

components/
├── landing/
│   ├── hero/
│   │   ├── HeroSection.tsx
│   │   ├── ThreeGlobe.tsx
│   │   └── TypewriterText.tsx
│   ├── features/
│   │   ├── BeforeAfterComparison.tsx
│   │   └── FeatureShowcase.tsx
│   └── navigation/
│       └── ModernNavbar.tsx
├── chat/
│   ├── ChatInterface.tsx
│   ├── MessageBubble.tsx
│   ├── InputArea.tsx
│   └── ChatSidebar.tsx
└── ui/
    ├── animated-button.tsx
    ├── glow-card.tsx
    └── binary-background.tsx
```

## 3. New Components Implementation

### 3.1 Modern Navigation Component
```typescript
// components/landing/navigation/ModernNavbar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

interface ModernNavbarProps {
  className?: string
}

export function ModernNavbar({ className }: ModernNavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Products', href: '/products' },
    { name: 'About Us', href: '/about' },
    { name: 'Contacts', href: '/contact' },
  ]

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-ascendia-black/95 backdrop-blur-lg border-b border-ascendia-border'
          : 'bg-transparent'
      } ${className}`}
    >
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-ascendia-green to-ascendia-green-dark rounded-lg flex items-center justify-center">
              <span className="text-ascendia-black font-bold text-lg">A</span>
            </div>
            <span className="text-white font-bold text-xl">shadcn/studio</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-ascendia-gray hover:text-white transition-colors duration-200 relative group"
              >
                {item.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-ascendia-green transition-all duration-200 group-hover:w-full" />
              </Link>
            ))}
            <Button
              asChild
              className="bg-ascendia-green hover:bg-ascendia-green-dark text-ascendia-black font-semibold transition-all duration-200 hover:scale-105"
            >
              <Link href="/login">Login</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-ascendia-dark border-t border-ascendia-border"
          >
            <div className="px-4 py-4 space-y-3">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block text-ascendia-gray hover:text-white transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Button className="w-full bg-ascendia-green hover:bg-ascendia-green-dark text-ascendia-black">
                Login
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  )
}
```

### 3.2 Three.js Globe Component
```typescript
// components/landing/hero/ThreeGlobe.tsx
'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, Text } from '@react-three/drei'
import * as THREE from 'three'

function BinaryParticle({ position, text }: { position: [number, number, number]; text: string }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime + position[0]) * 0.1
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime + position[1]) * 0.1
    }
  })

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={0.3}
      color="#00ff88"
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  )
}

function GlobeCore() {
  const globeRef = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.005
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.01
    }
  })

  // Generate binary particles around the globe
  const binaryParticles = useMemo(() => {
    const particles = []
    const binaryChars = ['0', '1']

    for (let i = 0; i < 100; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const radius = 3 + Math.random() * 2

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)

      particles.push({
        position: [x, y, z] as [number, number, number],
        text: binaryChars[Math.floor(Math.random() * binaryChars.length)]
      })
    }

    return particles
  }, [])

  return (
    <>
      {/* Main Globe */}
      <Sphere ref={globeRef} args={[2, 32, 32]}>
        <meshStandardMaterial
          color="#000000"
          wireframe={true}
          wireframeLinewidth={1}
          transparent={true}
          opacity={0.3}
        />
      </Sphere>

      {/* Glowing Core */}
      <Sphere args={[1.8, 32, 32]}>
        <meshBasicMaterial
          color="#00ff88"
          transparent={true}
          opacity={0.1}
        />
      </Sphere>

      {/* Binary Particles */}
      <group ref={particlesRef}>
        {binaryParticles.map((particle, index) => (
          <BinaryParticle
            key={index}
            position={particle.position}
            text={particle.text}
          />
        ))}
      </group>

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00ff88" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />
    </>
  )
}

export function ThreeGlobe() {
  return (
    <div className="w-full h-[500px] relative">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <GlobeCore />
      </Canvas>
    </div>
  )
}
```

### 3.3 Hero Section with Compelling Headlines
```typescript
// components/landing/hero/HeroSection.tsx
'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'
import { ThreeGlobe } from './ThreeGlobe'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="min-h-screen bg-ascendia-black relative overflow-hidden flex items-center">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-ascendia-green/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ascendia-green/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left Column - Content */}
        <div className="space-y-8">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-ascendia-green/10 border border-ascendia-green/30 rounded-full px-4 py-2"
          >
            <div className="w-2 h-2 bg-ascendia-green rounded-full animate-pulse" />
            <span className="text-ascendia-green text-sm font-medium">
              AI-Powered Content Creation
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight"
          >
            <span className="text-white">Stop Copy-Pasting</span>
            <br />
            <span className="text-ascendia-green">AI Prompts.</span>
            <br />
            <span className="text-white">Start Creating</span>
            <br />
            <span className="relative">
              <span className="bg-gradient-to-r from-ascendia-green to-white bg-clip-text text-transparent">
                Professional Content
              </span>
              <div className="absolute -inset-4 bg-ascendia-green/20 blur-xl rounded-full animate-glow-pulse -z-10" />
            </span>
            <br />
            <span className="text-ascendia-gray">That Actually Works.</span>
          </motion.h1>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <p className="text-xl text-ascendia-gray leading-relaxed">
              Transform raw ideas into polished, professional content with AI that understands your unique voice and style.
            </p>
            <p className="text-lg text-ascendia-gray-dark">
              No more generic responses. No more endless prompt engineering. Just authentic, high-quality content that sounds like you.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button
              asChild
              size="lg"
              className="bg-ascendia-green hover:bg-ascendia-green-dark text-ascendia-black font-semibold px-8 py-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-ascendia-green/25"
            >
              <Link href="/chat" className="flex items-center gap-2">
                Start Creating Now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="border-ascendia-green/50 text-ascendia-green hover:bg-ascendia-green/10 px-8 py-4 transition-all duration-300 hover:scale-105"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              See How It Works
            </Button>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="pt-8 border-t border-ascendia-border"
          >
            <p className="text-ascendia-gray-dark text-sm mb-2">
              Trusted by 10,000+ content creators
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-ascendia-green rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column - 3D Globe */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="flex justify-center"
        >
          <ThreeGlobe />
        </motion.div>
      </div>
    </section>
  )
}
```

### 3.4 Before/After Content Comparison
```typescript
// components/landing/features/BeforeAfterComparison.tsx
'use client'

import { motion } from 'framer-motion'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'

const comparisonData = [
  {
    before: "The meeting went really good and we discussed some stuff about the project and timeline.",
    after: "The meeting was highly productive, and we thoroughly reviewed project milestones and delivery timelines.",
    category: "Professional Communication"
  },
  {
    before: "Our product is better than competitors because it has more features and costs less money.",
    after: "Our solution delivers superior value through advanced functionality and competitive pricing, ensuring maximum ROI for our clients.",
    category: "Sales Copy"
  },
  {
    before: "Thank you for your email. We will get back to you soon with more information about your request.",
    after: "Thank you for your inquiry. We appreciate your interest and will provide a comprehensive response within 24 hours to address your specific requirements.",
    category: "Customer Service"
  }
]

export function BeforeAfterComparison() {
  return (
    <section className="py-24 bg-gradient-to-b from-ascendia-black to-ascendia-dark">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-ascendia-green/10 border border-ascendia-green/30 rounded-full px-4 py-2 mb-6">
            <span className="text-ascendia-green text-sm font-medium">
              Real Transformations
            </span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            See the{' '}
            <span className="bg-gradient-to-r from-ascendia-green to-white bg-clip-text text-transparent">
              Difference
            </span>
          </h2>

          <p className="text-xl text-ascendia-gray max-w-3xl mx-auto">
            Watch how Ascendia transforms everyday writing into professional, polished content while preserving your authentic voice.
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="space-y-8">
          {comparisonData.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="bg-ascendia-darker/50 border border-ascendia-border rounded-xl p-8 backdrop-blur-sm"
            >
              <div className="mb-4">
                <span className="text-ascendia-green text-sm font-medium bg-ascendia-green/10 px-3 py-1 rounded-full">
                  {item.category}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-center">
                {/* Before */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-500 font-medium text-sm">Before</span>
                  </div>
                  <p className="text-ascendia-gray-dark text-sm leading-relaxed italic">
                    "{item.before}"
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="bg-ascendia-green/10 p-3 rounded-full">
                    <ArrowRight className="h-6 w-6 text-ascendia-green" />
                  </div>
                </div>

                {/* After */}
                <div className="bg-ascendia-green/5 border border-ascendia-green/20 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-ascendia-green" />
                    <span className="text-ascendia-green font-medium text-sm">After</span>
                  </div>
                  <p className="text-white text-sm leading-relaxed">
                    "{item.after}"
                  </p>
                </div>
              </div>

              {/* Enhancement Stats */}
              <div className="mt-6 flex justify-center">
                <div className="inline-flex items-center gap-4 text-xs text-ascendia-gray-dark">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-ascendia-green rounded-full animate-pulse" />
                    Enhanced in 2.1s
                  </span>
                  <span>•</span>
                  <span>+67% readability</span>
                  <span>•</span>
                  <span>Voice preserved: 98%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-ascendia-gray mb-6">
            Ready to transform your writing?
          </p>
          <div className="inline-flex items-center gap-4 bg-ascendia-darker/50 border border-ascendia-border rounded-full px-6 py-3">
            <span className="text-ascendia-green text-sm font-medium">
              Try with your content
            </span>
            <ArrowRight className="h-4 w-4 text-ascendia-green" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
```

## 4. ChatUI Integration Analysis & Recommendation

### Evaluation of Chat Libraries

**1. Supabase ChatUI**
- **Pros**: Integrated with Supabase, good for real-time features
- **Cons**: Limited customization, might not match black theme requirements
- **Recommendation**: Skip - too opinionated for custom design

**2. Claude ChatUI**
- **Pros**: Anthropic's official interface, clean design
- **Cons**: Not easily customizable, limited styling options
- **Recommendation**: Use as reference only

**3. Gemini ChatUI**
- **Pros**: Google's implementation, modern design patterns
- **Cons**: Heavy dependency, complex integration
- **Recommendation**: Skip - too complex for custom requirements

### Recommended Approach: Custom Chat Interface

Build a custom chat interface using existing project dependencies:

```typescript
// components/chat/ChatInterface.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Copy, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  isStreaming?: boolean
}

interface ChatInterfaceProps {
  className?: string
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI response - replace with actual API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'll help you enhance that content while preserving your authentic voice. Here's an improved version...",
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className={`flex flex-col h-full bg-ascendia-black ${className}`}>
      {/* Chat Header */}
      <div className="border-b border-ascendia-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-ascendia-green to-ascendia-green-dark rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-ascendia-black" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Ascendia AI</h2>
            <p className="text-ascendia-gray-dark text-sm">Your professional writing assistant</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-3xl ${message.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-ascendia-green text-ascendia-black'
                      : 'bg-ascendia-darker border border-ascendia-border text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>

                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2 px-2">
                    <Button size="sm" variant="ghost" className="h-8 text-ascendia-gray-dark hover:text-ascendia-green">
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-ascendia-gray-dark hover:text-ascendia-green">
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-ascendia-gray-dark hover:text-red-500">
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mb-6"
          >
            <div className="max-w-3xl mr-12">
              <div className="bg-ascendia-darker border border-ascendia-border rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-ascendia-gray">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-ascendia-green rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-ascendia-green rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-ascendia-green rounded-full animate-bounce delay-150" />
                  </div>
                  <span className="text-sm">Analyzing and enhancing...</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-ascendia-border p-4">
        <div className="flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Paste your content here to enhance it..."
            className="bg-ascendia-darker border-ascendia-border text-white placeholder:text-ascendia-gray-dark resize-none"
            rows={3}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-ascendia-green hover:bg-ascendia-green-dark text-ascendia-black shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-ascendia-gray-dark text-xs mt-2">
          Press Enter to send, Shift + Enter for new line
        </p>
      </div>
    </div>
  )
}
```

## 5. Layout and Global Styling Updates

### 5.1 Updated globals.css
```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 0%;  /* Pure black */
    --foreground: 0 0% 100%;  /* White */

    --card: 0 0% 4%;  /* Very dark gray */
    --card-foreground: 0 0% 100%;

    --popover: 0 0% 4%;
    --popover-foreground: 0 0% 100%;

    --primary: 120 100% 53%;  /* Bright green */
    --primary-foreground: 0 0% 0%;

    --secondary: 0 0% 8%;
    --secondary-foreground: 0 0% 100%;

    --muted: 0 0% 8%;
    --muted-foreground: 0 0% 63%;

    --accent: 120 100% 53%;
    --accent-foreground: 0 0% 0%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 100%;

    --border: 0 0% 20%;
    --input: 0 0% 8%;
    --ring: 120 100% 53%;

    --radius: 0.75rem;
  }

  .dark {
    --background: 0 0% 0%;
    --foreground: 0 0% 100%;

    --card: 0 0% 4%;
    --card-foreground: 0 0% 100%;

    --popover: 0 0% 4%;
    --popover-foreground: 0 0% 100%;

    --primary: 120 100% 53%;
    --primary-foreground: 0 0% 0%;

    --secondary: 0 0% 8%;
    --secondary-foreground: 0 0% 100%;

    --muted: 0 0% 8%;
    --muted-foreground: 0 0% 63%;

    --accent: 120 100% 53%;
    --accent-foreground: 0 0% 0%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 100%;

    --border: 0 0% 20%;
    --input: 0 0% 8%;
    --ring: 120 100% 53%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    background: #000000;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    @apply bg-ascendia-dark;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-ascendia-border rounded-full;
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply bg-ascendia-green/30;
  }
}

@layer components {
  .glow-green {
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  }

  .glow-green-strong {
    box-shadow: 0 0 40px rgba(0, 255, 136, 0.6);
  }
}
```

### 5.2 Updated Layout Component
```typescript
// app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Ascendia - Professional AI Writing Assistant",
  description: "Stop copy-pasting AI prompts. Start creating professional content that actually works with AI that understands your voice.",
  keywords: "AI writing, content creation, professional writing, AI assistant",
  openGraph: {
    title: "Ascendia - Professional AI Writing Assistant",
    description: "Transform your writing with AI that preserves your authentic voice",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-ascendia-black min-h-screen`}>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
```

## 6. New Landing Page Implementation

### 6.1 Complete Landing Page
```typescript
// app/page.tsx
import { ModernNavbar } from '@/components/landing/navigation/ModernNavbar'
import { HeroSection } from '@/components/landing/hero/HeroSection'
import { BeforeAfterComparison } from '@/components/landing/features/BeforeAfterComparison'
import { FeatureShowcase } from '@/components/landing/features/FeatureShowcase'
import { Footer } from '@/components/layout/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ascendia-black">
      <ModernNavbar />
      <main>
        <HeroSection />
        <BeforeAfterComparison />
        <FeatureShowcase />
      </main>
      <Footer />
    </div>
  )
}
```

### 6.2 Chat Page Implementation
```typescript
// app/chat/page.tsx
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ModernNavbar } from '@/components/landing/navigation/ModernNavbar'

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-ascendia-black">
      <ModernNavbar />
      <main className="pt-16 h-screen">
        <ChatInterface className="h-[calc(100vh-4rem)]" />
      </main>
    </div>
  )
}
```

## 7. Performance Optimizations

### 7.1 Image Optimization Strategy
```typescript
// components/ui/optimized-image.tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = ''
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        onLoad={() => setIsLoaded(true)}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-ascendia-darker animate-pulse" />
      )}
    </div>
  )
}
```

### 7.2 Code Splitting Strategy
```typescript
// Dynamic imports for heavy components
import dynamic from 'next/dynamic'

const ThreeGlobe = dynamic(
  () => import('@/components/landing/hero/ThreeGlobe').then(mod => ({ default: mod.ThreeGlobe })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-ascendia-darker/50 border border-ascendia-border rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-ascendia-gray">Loading 3D visualization...</div>
      </div>
    )
  }
)

const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface').then(mod => ({ default: mod.ChatInterface })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full bg-ascendia-black flex items-center justify-center">
        <div className="text-ascendia-gray">Loading chat interface...</div>
      </div>
    )
  }
)
```

## 8. Accessibility Implementation

### 8.1 ARIA Labels and Screen Reader Support
```typescript
// Accessibility utilities
export const accessibilityProps = {
  skipLink: {
    'aria-label': 'Skip to main content',
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-ascendia-green text-ascendia-black p-2 z-50'
  },
  nav: {
    role: 'navigation',
    'aria-label': 'Main navigation'
  },
  chatMessages: {
    role: 'log',
    'aria-live': 'polite',
    'aria-label': 'Chat messages'
  },
  chatInput: {
    'aria-label': 'Message input',
    'aria-describedby': 'chat-input-help'
  }
}
```

### 8.2 Keyboard Navigation
```typescript
// components/ui/keyboard-navigation.tsx
'use client'

import { useEffect } from 'react'

export function useKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Focus management for modal dialogs
      if (event.key === 'Escape') {
        const activeElement = document.activeElement as HTMLElement
        if (activeElement?.closest('[role="dialog"]')) {
          const closeButton = document.querySelector('[data-close-modal]') as HTMLElement
          closeButton?.click()
        }
      }

      // Skip to main content
      if (event.key === 'Tab' && !event.shiftKey && event.target === document.body) {
        const skipLink = document.querySelector('[href="#main"]') as HTMLElement
        skipLink?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

## 9. Testing Strategy

### 9.1 Component Testing
```typescript
// __tests__/components/ModernNavbar.test.tsx
import { render, screen } from '@testing-library/react'
import { ModernNavbar } from '@/components/landing/navigation/ModernNavbar'

describe('ModernNavbar', () => {
  it('renders all navigation items', () => {
    render(<ModernNavbar />)

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('About Us')).toBeInTheDocument()
    expect(screen.getByText('Contacts')).toBeInTheDocument()
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(<ModernNavbar />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'Main navigation')
  })
})
```

### 9.2 E2E Testing
```typescript
// tests/e2e/landing-page.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should display hero section with correct headline', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('h1')).toContainText('Stop Copy-Pasting AI Prompts')
    await expect(page.locator('h1')).toContainText('Start Creating Professional Content')
  })

  test('should navigate to chat page when CTA is clicked', async ({ page }) => {
    await page.goto('/')

    await page.click('text=Start Creating Now')
    await expect(page).toHaveURL('/chat')
  })

  test('should have working 3D globe animation', async ({ page }) => {
    await page.goto('/')

    const globe = page.locator('canvas')
    await expect(globe).toBeVisible()
  })
})
```

## 10. Deployment Considerations

### 10.1 Environment Configuration
```typescript
// next.config.js updates
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },

  // Bundle analysis
  webpack: (config, { dev, isServer }) => {
    // Three.js optimization
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
      }
    }

    return config
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  }
}

module.exports = nextConfig
```

### 10.2 SEO Optimization
```typescript
// app/metadata.ts
export const siteConfig = {
  name: 'Ascendia',
  description: 'Professional AI Writing Assistant - Stop copy-pasting prompts, start creating content that works',
  url: 'https://ascendia.ai',
  ogImage: 'https://ascendia.ai/og-image.png',
  links: {
    twitter: 'https://twitter.com/ascendia_ai',
    github: 'https://github.com/ascendia-ai',
  },
}

// Dynamic metadata for pages
export function generatePageMetadata(title: string, description: string) {
  return {
    title: `${title} | ${siteConfig.name}`,
    description,
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      type: 'website',
      url: siteConfig.url,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [siteConfig.ogImage],
    },
  }
}
```

## 11. Installation & Setup Commands

### Required Dependencies Installation
```bash
# Already installed in your project:
# @react-three/fiber @react-three/drei @types/three
# framer-motion zustand @tanstack/react-query

# Additional shadcn/ui components needed:
pnpm dlx shadcn-ui@latest add scroll-area
pnpm dlx shadcn-ui@latest add textarea
pnpm dlx shadcn-ui@latest add toast
pnpm dlx shadcn-ui@latest add avatar
pnpm dlx shadcn-ui@latest add badge

# Optional for enhanced animations:
pnpm install lottie-react
pnpm install react-intersection-observer
```

## Summary

This comprehensive implementation plan provides:

✅ **Black Background Theme**: Complete dark theme with bright green accents
✅ **Modern Navbar**: Clean, professional navigation matching shadcn/studio aesthetic
✅ **Compelling Headlines**: Exactly as requested with professional positioning
✅ **3D Globe Animation**: React Three Fiber implementation with rotating binary characters
✅ **Before/After Comparison**: Interactive content transformation showcase
✅ **Custom Chat Interface**: Professional chatbot UI instead of third-party solutions
✅ **Performance Optimized**: Code splitting, image optimization, and accessibility
✅ **Production Ready**: Testing, deployment, and SEO considerations included

The implementation leverages your existing project structure and dependencies while introducing the requested design changes and new interactive elements. The modular component architecture ensures maintainability and scalability.