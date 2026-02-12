'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { InteractiveFeatures } from '@/components/landing/features/InteractiveFeatures'
import { AnimatedFlow } from '@/components/landing/process/AnimatedFlow'
import {
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  Upload,
  Search,
  Shield,
  Clock,
  FileText,
  CheckCircle,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Star,
  Users,
  Globe,
  Award
} from 'lucide-react'

export default function FeaturesPage() {
  const [activeDemo, setActiveDemo] = useState('voice-learning')

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-[#2e5797]/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <nav className="hidden md:flex items-center space-x-8">
            <a href="/" className="text-muted-foreground hover:text-[#2e5797] transition-colors">Home</a>
            <a href="/features" className="text-[#2e5797] font-medium">Features</a>
            <a href="/about" className="text-muted-foreground hover:text-[#2e5797] transition-colors">About</a>
            <a href="/feedback" className="text-muted-foreground hover:text-[#2e5797] transition-colors">Feedback</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-[#2e5797]/10 to-transparent">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
            Feature Overview
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
              Powerful AI Features
            </span>
            <br />
            <span className="text-foreground">That Enhance Your Voice</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed mb-8">
            Discover how Ascendia's advanced AI capabilities transform your writing process
            while preserving the authentic voice that makes your content uniquely yours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-8 py-4 text-lg"
            >
              Try All Features
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#2e5797] text-[#2e5797] hover:bg-[#2e5797]/10 px-8 py-4 text-lg"
            >
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
              Core Capabilities
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Revolutionary AI Technology
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Experience the most advanced writing enhancement system designed to understand and preserve your unique style
            </p>
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
            {[
              {
                icon: Brain,
                title: "AI Voice Learning",
                description: "Advanced neural networks that learn your writing patterns",
                features: ["Style recognition", "Tone adaptation", "Personal voice modeling", "Context understanding"],
                color: "#2e5797",
                stats: "99.9% accuracy"
              },
              {
                icon: Sparkles,
                title: "Dual Draft Generation",
                description: "Get both grammar fixes and style-enhanced versions",
                features: ["Grammar-only option", "Style enhancement", "Voice preservation", "Compare versions"],
                color: "#4a7bc8",
                stats: "2x faster editing"
              },
              {
                icon: Zap,
                title: "Real-time Processing",
                description: "Instant feedback with streaming AI technology",
                features: ["Live enhancement", "Streaming responses", "No waiting time", "Instant feedback"],
                color: "#6b8dd6",
                stats: "< 1s response"
              },
              {
                icon: TrendingUp,
                title: "Progressive Learning",
                description: "AI that gets smarter with every interaction",
                features: ["Continuous improvement", "Usage pattern analysis", "Preference tracking", "Adaptive suggestions"],
                color: "#1a3d6b",
                stats: "300% learning rate"
              }
            ].map((feature, index) => (
              <Card key={index} className="p-6 bg-card/50 backdrop-blur-sm border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(46,87,151,0.2)] group">
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: feature.color }}
                  >
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-[#2e5797] transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground mb-4 text-sm">{feature.description}</p>
                  <div className="space-y-2 mb-4">
                    {feature.features.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-[#2e5797] flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-bold text-[#2e5797]">{feature.stats}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
              Live Demo
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                See Features in Action
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Experience how each feature works with interactive demonstrations
            </p>

            {/* Demo Controls */}
            <div className="flex flex-wrap gap-4 justify-center">
              {[
                { id: 'voice-learning', label: 'Voice Learning', icon: Brain },
                { id: 'dual-draft', label: 'Dual Drafts', icon: Sparkles },
                { id: 'real-time', label: 'Real-time', icon: Zap },
                { id: 'progressive', label: 'Progressive', icon: TrendingUp }
              ].map((demo) => (
                <Button
                  key={demo.id}
                  variant={activeDemo === demo.id ? 'default' : 'outline'}
                  onClick={() => setActiveDemo(demo.id)}
                  className={activeDemo === demo.id
                    ? 'bg-[#2e5797] hover:bg-[#4a7bc8]'
                    : 'border-[#2e5797]/30 text-[#2e5797] hover:bg-[#2e5797]/10'}
                >
                  <demo.icon className="h-4 w-4 mr-2" />
                  {demo.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Demo Content */}
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 bg-card/50 backdrop-blur-sm border-[#2e5797]/20">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-[#2e5797]">
                    {activeDemo === 'voice-learning' && 'AI Voice Learning'}
                    {activeDemo === 'dual-draft' && 'Dual Draft Generation'}
                    {activeDemo === 'real-time' && 'Real-time Processing'}
                    {activeDemo === 'progressive' && 'Progressive Learning'}
                  </h3>
                  <div className="space-y-4 text-muted-foreground">
                    {activeDemo === 'voice-learning' && (
                      <>
                        <p>Watch as our AI analyzes your writing patterns and builds a personalized voice profile.</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Tone preference detection</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Style pattern recognition</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Vocabulary analysis</li>
                        </ul>
                      </>
                    )}
                    {activeDemo === 'dual-draft' && (
                      <>
                        <p>See how Ascendia generates two distinct versions of your enhanced content.</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Grammar-only corrections</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Style-enhanced version</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Voice preservation</li>
                        </ul>
                      </>
                    )}
                    {activeDemo === 'real-time' && (
                      <>
                        <p>Experience lightning-fast processing with streaming AI responses.</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Instant analysis</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Streaming enhancements</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Live feedback</li>
                        </ul>
                      </>
                    )}
                    {activeDemo === 'progressive' && (
                      <>
                        <p>Discover how our AI continuously improves its understanding of your style.</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Learning from interactions</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Preference adaptation</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#2e5797]" />Improved suggestions</li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-[#2e5797]/10 to-[#1a3d6b]/10 rounded-lg p-6 border border-[#2e5797]/20">
                  {/* Dynamic demo content based on active demo */}
                  {activeDemo === 'voice-learning' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span>Analyzing writing patterns...</span>
                      </div>
                      <div className="bg-background/50 rounded p-3 font-mono text-xs">
                        Voice Profile: Professional, Concise<br/>
                        Tone: 85% Formal, 15% Conversational<br/>
                        Complexity: Advanced<br/>
                        CPL Score: 7.8/10
                      </div>
                      <div className="text-xs text-[#2e5797] font-medium">95% voice accuracy achieved</div>
                    </div>
                  )}
                  {activeDemo === 'dual-draft' && (
                    <div className="space-y-4">
                      <div className="text-sm font-medium mb-2">Enhanced Versions:</div>
                      <div className="grid gap-2">
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                          <div className="text-red-600 dark:text-red-400 text-xs font-medium">Grammar Only</div>
                          <div className="text-xs mt-1">Quick corrections, original style preserved</div>
                        </div>
                        <div className="bg-[#2e5797]/10 p-3 rounded border border-[#2e5797]/30">
                          <div className="text-[#2e5797] text-xs font-medium">Style Enhanced</div>
                          <div className="text-xs mt-1">Your voice + professional polish</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeDemo === 'real-time' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 border-2 border-[#2e5797] border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing in real-time...</span>
                      </div>
                      <div className="bg-gradient-to-r from-[#2e5797]/20 to-transparent p-3 rounded">
                        <div className="text-xs">
                          Response time: <span className="text-[#2e5797] font-mono">847ms</span><br/>
                          Analysis: <span className="text-[#2e5797] font-mono">Complete</span><br/>
                          Enhancement: <span className="text-[#2e5797] font-mono">Streaming</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeDemo === 'progressive' && (
                    <div className="space-y-4">
                      <div className="text-sm font-medium mb-2">Learning Progress:</div>
                      <div className="space-y-2">
                        {['Week 1', 'Week 2', 'Week 3'].map((week, i) => (
                          <div key={week} className="flex items-center gap-2 text-xs">
                            <div className="w-12">{week}:</div>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-[#2e5797] h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${(i + 1) * 30}%` }}
                              />
                            </div>
                            <div className="text-[#2e5797]">{(i + 1) * 30}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
              Use Cases
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Perfect for Every Writing Need
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              From professional communication to creative writing, Ascendia adapts to your specific requirements
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Business Communication",
                description: "Professional emails, reports, and proposals",
                benefits: ["Professional tone", "Clear messaging", "Error-free content", "Brand consistency"],
                color: "#2e5797"
              },
              {
                icon: Users,
                title: "Academic Writing",
                description: "Essays, research papers, and academic content",
                benefits: ["Formal tone", "Complex arguments", "Citation support", "Academic style"],
                color: "#4a7bc8"
              },
              {
                icon: Globe,
                title: "Content Creation",
                description: "Blogs, articles, and marketing content",
                benefits: ["Engaging tone", "SEO optimization", "Reader-friendly", "Brand voice"],
                color: "#6b8dd6"
              },
              {
                icon: Award,
                title: "Creative Writing",
                description: "Stories, scripts, and creative projects",
                benefits: ["Voice preservation", "Style enhancement", "Flow improvement", "Creative support"],
                color: "#1a3d6b"
              },
              {
                icon: Shield,
                title: "Technical Writing",
                description: "Documentation, manuals, and guides",
                benefits: ["Clear instructions", "Technical accuracy", "User-friendly", "Consistent style"],
                color: "#2e5797"
              },
              {
                icon: Star,
                title: "Personal Writing",
                description: "Letters, journals, and personal communication",
                benefits: ["Personal voice", "Natural tone", "Grammar fixes", "Style polish"],
                color: "#4a7bc8"
              }
            ].map((useCase, index) => (
              <Card key={index} className="p-6 bg-card/50 backdrop-blur-sm border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 group">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: useCase.color }}
                >
                  <useCase.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-[#2e5797] transition-colors">{useCase.title}</h3>
                <p className="text-muted-foreground mb-4 text-sm">{useCase.description}</p>
                <div className="space-y-2">
                  {useCase.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-[#2e5797] flex-shrink-0" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
              Technical Details
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Built for Performance
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Advanced AI architecture designed for speed, accuracy, and scalability
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-[#2e5797]">Performance Metrics</h3>
              <div className="space-y-6">
                {[
                  { metric: "Processing Speed", value: "< 1 second", description: "Average response time for content analysis" },
                  { metric: "Voice Accuracy", value: "99.9%", description: "Preservation of user writing style" },
                  { metric: "Grammar Detection", value: "98.7%", description: "Error identification accuracy" },
                  { metric: "User Satisfaction", value: "4.9/5", description: "Average user rating" },
                  { metric: "Uptime", value: "99.99%", description: "Service availability guarantee" }
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-[#2e5797]/20">
                    <div>
                      <div className="font-semibold">{item.metric}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                    <div className="text-2xl font-bold text-[#2e5797]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-6 text-[#2e5797]">AI Capabilities</h3>
              <div className="space-y-4">
                {[
                  { capability: "Natural Language Processing", level: 95 },
                  { capability: "Style Recognition", level: 92 },
                  { capability: "Context Understanding", level: 89 },
                  { capability: "Voice Adaptation", level: 96 },
                  { capability: "Real-time Processing", level: 94 }
                ].map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{item.capability}</span>
                      <span className="text-[#2e5797] font-mono">{item.level}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-[#2e5797] to-[#4a7bc8] h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${item.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Ready to Experience These Features?
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Transform your writing process with AI that understands and enhances your unique voice.
              Start your free trial today and see the difference.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-8 py-4 text-lg"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-[#2e5797] text-[#2e5797] hover:bg-[#2e5797]/10 px-8 py-4 text-lg"
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2e5797]/20 bg-card/50 backdrop-blur-sm py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Logo size="sm" className="mb-4" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                AI-powered writing enhancement that preserves your authentic voice.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Product</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><a href="/features" className="hover:text-[#2e5797] transition-colors">Features</a></div>
                <div><a href="/" className="hover:text-[#2e5797] transition-colors">How it Works</a></div>
                <div><a href="/feedback" className="hover:text-[#2e5797] transition-colors">Pricing</a></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Company</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><a href="/about" className="hover:text-[#2e5797] transition-colors">About Us</a></div>
                <div><a href="/feedback" className="hover:text-[#2e5797] transition-colors">Contact</a></div>
                <div><a href="#" className="hover:text-[#2e5797] transition-colors">Privacy Policy</a></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Connect</h4>
              <div className="flex gap-4">
                <a href="#" className="text-muted-foreground hover:text-[#2e5797] transition-colors">
                  <Star className="h-5 w-5" />
                </a>
                <a href="#" className="text-muted-foreground hover:text-[#2e5797] transition-colors">
                  <Users className="h-5 w-5" />
                </a>
                <a href="#" className="text-muted-foreground hover:text-[#2e5797] transition-colors">
                  <Globe className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-[#2e5797]/20 mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 Ascendia. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}