import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Brain, Shield, Users, Zap, Target, Lightbulb, TrendingUp, Globe } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Ascendia - AI Writing Assistant That Preserves Your Voice | Ascendia',
  description: 'Discover how Ascendia\'s proprietary Content Polish Level (CPL) system learns and adapts to your unique writing style, providing personalized writing enhancement that preserves authenticity while improving clarity.',
  keywords: 'AI writing assistant, personalized writing enhancement, voice preservation, content polish level, grammar correction, style enhancement, adaptive AI, writing improvement, natural language processing, machine learning, writing style analysis',
  openGraph: {
    title: 'About Ascendia - AI Writing Assistant That Preserves Your Voice',
    description: 'Learn how Ascendia revolutionizes writing enhancement with AI that adapts to your unique style while maintaining authenticity.',
    type: 'website',
    url: '/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Ascendia - AI Writing Assistant That Preserves Your Voice',
    description: 'Learn how Ascendia revolutionizes writing enhancement with AI that adapts to your unique style while maintaining authenticity.',
  },
  alternates: {
    canonical: '/about',
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo size="lg" />
          <nav className="hidden md:flex gap-6">
            <Link href="/features" className="text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="/about" className="text-foreground font-medium">
              About
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b]">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-16 bg-gradient-to-br from-[#2e5797]/10 via-transparent to-[#1a3d6b]/10 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-[#2e5797]/20 rounded-full animate-pulse"></div>
            <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-[#4a7bc8]/30 rounded-full animate-bounce"></div>
          </div>

          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-[#2e5797]/10 border border-[#2e5797]/20 rounded-full px-4 py-2 mb-8">
                <Target className="w-4 h-4 text-[#2e5797]" />
                <span className="text-sm font-medium text-[#2e5797]">Our Mission</span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Writing Enhancement<br />
                <span className="relative">
                  That Honors You
                  <div className="absolute -inset-2 bg-[#2e5797]/20 blur-xl rounded-full animate-pulse"></div>
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
                At Ascendia, we believe your writing voice is uniquely yours. Our mission is to enhance your content while preserving the authenticity that makes your communication distinctly human.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] px-8 py-4 text-lg transition-all duration-300 hover:scale-105">
                    Experience Our Vision
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* The Story Section */}
        <section className="py-24 bg-muted/30" id="our-story">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 bg-[#2e5797]/10 border border-[#2e5797]/20 rounded-full px-4 py-2 mb-6">
                  <Lightbulb className="w-4 h-4 text-[#2e5797]" />
                  <span className="text-sm font-medium text-[#2e5797]">The Genesis</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                  Why Ascendia Exists
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
                <div>
                  <h3 className="text-2xl font-bold mb-6 text-[#2e5797]">The Problem We Saw</h3>
                  <div className="space-y-4 text-muted-foreground">
                    <p className="text-lg leading-relaxed">
                      Traditional writing tools treat every user the same. They apply generic corrections and enhancements that strip away the personality and unique voice that makes each writer special.
                    </p>
                    <p className="text-lg leading-relaxed">
                      We watched talented writers lose their authentic voice to one-size-fits-all AI tools that prioritized perfect grammar over personal expression. Professional communication became sterile, creative writing lost its spark, and individual style was sacrificed for algorithmic conformity.
                    </p>
                    <p className="text-lg leading-relaxed">
                      The market was missing something crucial: an AI writing assistant that could enhance content while learning and adapting to preserve each user's unique writing DNA.
                    </p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-[#2e5797]/10 to-[#1a3d6b]/10 p-8 rounded-lg border border-[#2e5797]/20">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <span className="text-red-600 dark:text-red-400 text-xl">❌</span>
                      </div>
                      <div>
                        <h4 className="font-semibold">Generic Enhancement</h4>
                        <p className="text-sm text-muted-foreground">Same corrections for everyone</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <span className="text-red-600 dark:text-red-400 text-xl">📝</span>
                      </div>
                      <div>
                        <h4 className="font-semibold">Voice Erasure</h4>
                        <p className="text-sm text-muted-foreground">Personal style gets lost</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <span className="text-red-600 dark:text-red-400 text-xl">🤖</span>
                      </div>
                      <div>
                        <h4 className="font-semibold">Robotic Output</h4>
                        <p className="text-sm text-muted-foreground">Content sounds artificial</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="bg-gradient-to-br from-[#2e5797]/10 to-[#1a3d6b]/10 p-8 rounded-lg border border-[#2e5797]/20 md:order-1">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <Brain className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Adaptive Learning</h4>
                        <p className="text-sm text-muted-foreground">AI that learns your style</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Voice Preservation</h4>
                        <p className="text-sm text-muted-foreground">Your authenticity protected</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Dual Enhancement</h4>
                        <p className="text-sm text-muted-foreground">Grammar + style options</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="md:order-2">
                  <h3 className="text-2xl font-bold mb-6 text-[#2e5797]">Our Innovation</h3>
                  <div className="space-y-4 text-muted-foreground">
                    <p className="text-lg leading-relaxed">
                      Ascendia was born from the realization that writing enhancement should be personal. We developed the revolutionary <strong>Content Polish Level (CPL) system</strong> - a proprietary scoring mechanism that measures and adapts to writing sophistication on a scale of 0-10.
                    </p>
                    <p className="text-lg leading-relaxed">
                      Our AI doesn't just correct grammar; it learns from every interaction, building a comprehensive understanding of your unique writing patterns, preferred sentence structures, vocabulary choices, and communication style.
                    </p>
                    <p className="text-lg leading-relaxed">
                      The result? An AI writing assistant that provides dual draft generation - offering both grammar-only fixes and style-enhanced versions that maintain your authentic voice while elevating your content's clarity and professionalism.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Approach Section */}
        <section className="py-24" id="our-approach">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 bg-[#2e5797]/10 border border-[#2e5797]/20 rounded-full px-4 py-2 mb-6">
                  <Brain className="w-4 h-4 text-[#2e5797]" />
                  <span className="text-sm font-medium text-[#2e5797]">Technical Innovation</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                  The CPL Advantage
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Our proprietary Content Polish Level system represents a breakthrough in personalized AI writing enhancement, measuring sophistication while preserving authenticity.
                </p>
              </div>

              <div className="grid lg:grid-cols-3 gap-8 mb-16">
                {/* Technical Innovation */}
                <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#2e5797] to-[#4a7bc8] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#2e5797] transition-colors">
                    Real-time Analysis
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Advanced natural language processing analyzes lexical diversity, sentence complexity, formality levels, and coherence patterns in real-time.
                  </p>
                  <div className="text-sm text-[#2e5797] font-medium">
                    Processing: &lt; 2 seconds
                  </div>
                </div>

                {/* Voice Preservation */}
                <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#4a7bc8] to-[#6b8dd6] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#4a7bc8] transition-colors">
                    Adaptive Learning
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Machine learning algorithms build comprehensive user writing profiles, adapting enhancement suggestions to match individual style preferences and communication patterns.
                  </p>
                  <div className="text-sm text-[#4a7bc8] font-medium">
                    Accuracy: 99.9% voice preservation
                  </div>
                </div>

                {/* Progressive Enhancement */}
                <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#6b8dd6] to-[#1a3d6b] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#1a3d6b] transition-colors">
                    Continuous Improvement
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Every interaction refines the AI's understanding of user preferences, creating progressively better enhancement suggestions with each use.
                  </p>
                  <div className="text-sm text-[#1a3d6b] font-medium">
                    Learning: Every interaction
                  </div>
                </div>
              </div>

              {/* CPL Score Visualization */}
              <div className="bg-gradient-to-r from-[#2e5797]/10 to-[#1a3d6b]/10 p-8 rounded-lg border border-[#2e5797]/20">
                <h3 className="text-2xl font-bold text-center mb-8 text-[#2e5797]">
                  Content Polish Level (CPL) Scale
                </h3>
                <div className="grid md:grid-cols-5 gap-4 text-center">
                  <div className="p-4 bg-background/50 rounded-lg">
                    <div className="text-2xl font-bold text-[#2e5797] mb-2">0-2</div>
                    <div className="text-sm font-medium mb-1">Casual</div>
                    <div className="text-xs text-muted-foreground">Informal, conversational tone</div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg">
                    <div className="text-2xl font-bold text-[#4a7bc8] mb-2">3-4</div>
                    <div className="text-sm font-medium mb-1">Balanced</div>
                    <div className="text-xs text-muted-foreground">Mix of formal and casual</div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg">
                    <div className="text-2xl font-bold text-[#6b8dd6] mb-2">5-6</div>
                    <div className="text-sm font-medium mb-1">Professional</div>
                    <div className="text-xs text-muted-foreground">Business communication</div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg">
                    <div className="text-2xl font-bold text-[#1a3d6b] mb-2">7-8</div>
                    <div className="text-sm font-medium mb-1">Formal</div>
                    <div className="text-xs text-muted-foreground">Academic, technical writing</div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg">
                    <div className="text-2xl font-bold text-[#0f2847] mb-2">9-10</div>
                    <div className="text-sm font-medium mb-1">Elite</div>
                    <div className="text-xs text-muted-foreground">Highly sophisticated prose</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values Section */}
        <section className="py-24 bg-muted/30" id="core-values">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 bg-[#2e5797]/10 border border-[#2e5797]/20 rounded-full px-4 py-2 mb-6">
                  <Shield className="w-4 h-4 text-[#2e5797]" />
                  <span className="text-sm font-medium text-[#2e5797]">Our Foundation</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                  Values That Guide Us
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Every decision at Ascendia is guided by our commitment to user authenticity, continuous innovation, and ethical AI development.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* User Authenticity */}
                <div className="text-center p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 group">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#2e5797] to-[#4a7bc8] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#2e5797] transition-colors">
                    User Authenticity
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Your unique writing voice is sacred. We enhance, never replace, the personality that makes your communication distinctly yours.
                  </p>
                </div>

                {/* Continuous Innovation */}
                <div className="text-center p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 group">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#4a7bc8] to-[#6b8dd6] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Lightbulb className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#4a7bc8] transition-colors">
                    Continuous Innovation
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    We constantly evolve our AI technology, pushing the boundaries of personalized writing enhancement while maintaining simplicity.
                  </p>
                </div>

                {/* Privacy & Security */}
                <div className="text-center p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 group">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#6b8dd6] to-[#1a3d6b] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#1a3d6b] transition-colors">
                    Privacy & Security
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Your content is protected with enterprise-grade security. We never share, sell, or misuse your personal writing data.
                  </p>
                </div>

                {/* Accessibility */}
                <div className="text-center p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 group">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#1a3d6b] to-[#2e5797] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-[#2e5797] transition-colors">
                    Universal Accessibility
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Writing enhancement should be available to everyone. We build inclusive tools that work across languages, cultures, and abilities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team Vision Section */}
        <section className="py-24" id="vision">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-[#2e5797]/10 border border-[#2e5797]/20 rounded-full px-4 py-2 mb-6">
                <TrendingUp className="w-4 h-4 text-[#2e5797]" />
                <span className="text-sm font-medium text-[#2e5797]">Future Forward</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                The Future of Writing
              </h2>

              <div className="text-xl text-muted-foreground mb-12 leading-relaxed">
                <p className="mb-6">
                  We envision a world where AI writing assistance enhances human creativity rather than replacing it. Where technology amplifies individual expression instead of standardizing it.
                </p>
                <p className="mb-6">
                  Our roadmap includes advanced features like <strong>multi-language voice preservation</strong>, <strong>industry-specific style adaptation</strong>, and <strong>collaborative writing enhancement</strong> for teams that need to maintain consistent voice across multiple contributors.
                </p>
                <p>
                  But technology is only as good as its purpose. Our commitment remains unwavering: to build AI that serves writers, not the other way around.
                </p>
              </div>

              {/* Statistics */}
              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <div className="p-6 bg-gradient-to-br from-[#2e5797]/10 to-[#4a7bc8]/10 rounded-lg border border-[#2e5797]/20">
                  <div className="text-3xl font-bold text-[#2e5797] mb-2">10,000+</div>
                  <div className="text-sm text-muted-foreground">Writers trust Ascendia globally</div>
                </div>
                <div className="p-6 bg-gradient-to-br from-[#4a7bc8]/10 to-[#6b8dd6]/10 rounded-lg border border-[#4a7bc8]/20">
                  <div className="text-3xl font-bold text-[#4a7bc8] mb-2">95%</div>
                  <div className="text-sm text-muted-foreground">User satisfaction rate</div>
                </div>
                <div className="p-6 bg-gradient-to-br from-[#6b8dd6]/10 to-[#1a3d6b]/10 rounded-lg border border-[#1a3d6b]/20">
                  <div className="text-3xl font-bold text-[#1a3d6b] mb-2">2M+</div>
                  <div className="text-sm text-muted-foreground">Documents enhanced monthly</div>
                </div>
              </div>

              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] px-8 py-4 text-lg transition-all duration-300 hover:scale-105">
                  Join Our Vision
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section for SEO */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-8">
                <div className="p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20">
                  <h3 className="text-xl font-bold mb-3 text-[#2e5797]">
                    How does Ascendia preserve my writing voice?
                  </h3>
                  <p className="text-muted-foreground">
                    Our Content Polish Level (CPL) system analyzes your writing patterns, vocabulary preferences, sentence structures, and communication style to create a personalized profile. This ensures all enhancements maintain your authentic voice while improving clarity and professionalism.
                  </p>
                </div>

                <div className="p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20">
                  <h3 className="text-xl font-bold mb-3 text-[#2e5797]">
                    What makes Ascendia different from other AI writing tools?
                  </h3>
                  <p className="text-muted-foreground">
                    Unlike generic AI writing tools, Ascendia provides dual draft generation (grammar-only and style-enhanced versions), learns from your specific writing patterns, and uses our proprietary CPL scoring system to adapt to your sophistication level. We focus on enhancement, not replacement.
                  </p>
                </div>

                <div className="p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20">
                  <h3 className="text-xl font-bold mb-3 text-[#2e5797]">
                    Is my content secure and private?
                  </h3>
                  <p className="text-muted-foreground">
                    Absolutely. We use enterprise-grade security measures to protect your content. Your writing data is never shared, sold, or used for any purpose other than improving your personal writing enhancement experience. All processing is secured with industry-standard encryption.
                  </p>
                </div>

                <div className="p-6 bg-card/50 backdrop-blur-sm rounded-lg border border-[#2e5797]/20">
                  <h3 className="text-xl font-bold mb-3 text-[#2e5797]">
                    How quickly does Ascendia process content?
                  </h3>
                  <p className="text-muted-foreground">
                    Our real-time streaming technology processes most content in 5-8 seconds total, with initial analysis beginning in under 2 seconds. The system provides immediate feedback while maintaining high-quality, personalized enhancements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-3xl font-bold mb-4">Ready to enhance your writing while preserving your voice?</h3>
            <p className="text-xl mb-8 opacity-90">
              Experience AI-powered writing enhancement that learns and adapts to your unique style.
            </p>
            <Link href="/register">
              <Button size="lg" variant="secondary" className="gap-2 hover:scale-105 transition-transform">
                Start Writing Better Today
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-muted/30 py-12">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Logo size="md" showText={true} />
            </div>
            <p>© 2024 Ascendia. All rights reserved.</p>
          </div>
        </footer>
      </main>

      {/* Schema Markup for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Ascendia",
            "description": "AI-powered writing assistant that preserves user voice while enhancing content with proprietary Content Polish Level (CPL) system",
            "url": "https://ascendia.ai",
            "logo": "https://ascendia.ai/logo.png",
            "foundingDate": "2024",
            "sameAs": [],
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "customer service",
              "availableLanguage": "English"
            },
            "products": [
              {
                "@type": "SoftwareApplication",
                "name": "Ascendia AI Writing Assistant",
                "applicationCategory": "Writing Software",
                "operatingSystem": "Web Browser",
                "description": "Personalized AI writing enhancement that preserves authentic voice while improving clarity and professionalism",
                "features": [
                  "Content Polish Level (CPL) scoring system",
                  "Dual draft generation (grammar-only and style-enhanced)",
                  "Real-time streaming content enhancement",
                  "Voice preservation technology",
                  "Adaptive learning algorithms"
                ]
              }
            ]
          })
        }}
      />
    </div>
  )
}