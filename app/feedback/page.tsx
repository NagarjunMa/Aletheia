'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import {
  Star,
  Quote,
  Users,
  Award,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Send,
  MessageCircle,
  Heart,
  ThumbsUp,
  Sparkles,
  Building,
  User,
  Calendar,
  Globe
} from 'lucide-react'

export default function FeedbackPage() {
  const [selectedRating, setSelectedRating] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
    category: 'general'
  })

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Content Marketing Manager",
      company: "TechFlow Inc.",
      rating: 5,
      text: "Ascendia has completely transformed how I approach content creation. The voice preservation is incredible - it enhances my writing while keeping it authentically mine.",
      avatar: "SC"
    },
    {
      name: "Dr. Michael Rodriguez",
      role: "Research Director",
      company: "Stanford University",
      rating: 5,
      text: "As an academic, maintaining my scholarly voice is crucial. Ascendia's CPL system adapts perfectly to academic writing while improving clarity and structure.",
      avatar: "MR"
    },
    {
      name: "Emily Watson",
      role: "Creative Director",
      company: "Brandspace Agency",
      rating: 5,
      text: "The dual draft feature is a game-changer. Having both grammar fixes and style enhancements gives me complete control over my creative process.",
      avatar: "EW"
    },
    {
      name: "James Liu",
      role: "Technical Writer",
      company: "DevTools Corp",
      rating: 5,
      text: "Real-time processing means I can write and edit simultaneously. It's like having a writing partner who understands my style perfectly.",
      avatar: "JL"
    },
    {
      name: "Maria Santos",
      role: "Business Consultant",
      company: "Growth Partners",
      rating: 5,
      text: "Client communications are now more professional and clear, yet they still sound like me. Ascendia strikes the perfect balance.",
      avatar: "MS"
    },
    {
      name: "David Kim",
      role: "Startup Founder",
      company: "InnovateNow",
      rating: 5,
      text: "From pitch decks to investor emails, Ascendia helps me communicate with confidence. The progressive learning means it gets better with every use.",
      avatar: "DK"
    }
  ]

  const stats = [
    { value: "10,000+", label: "Happy Users", icon: Users },
    { value: "4.9/5", label: "Average Rating", icon: Star },
    { value: "99%", label: "Satisfaction Rate", icon: ThumbsUp },
    { value: "2M+", label: "Documents Enhanced", icon: Award }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-[#2e5797]/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <nav className="hidden md:flex items-center space-x-8">
            <a href="/" className="text-muted-foreground hover:text-[#2e5797] transition-colors">Home</a>
            <a href="/features" className="text-muted-foreground hover:text-[#2e5797] transition-colors">Features</a>
            <a href="/about" className="text-muted-foreground hover:text-[#2e5797] transition-colors">About</a>
            <a href="/feedback" className="text-[#2e5797] font-medium">Feedback</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-[#2e5797]/10 to-transparent">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
            User Feedback
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
              What Users Say
            </span>
            <br />
            <span className="text-foreground">About Ascendia</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed mb-8">
            Join thousands of writers, professionals, and creators who have transformed
            their communication with Ascendia's AI-powered writing enhancement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-8 py-4 text-lg"
              onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Share Your Experience
              <MessageCircle className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#2e5797] text-[#2e5797] hover:bg-[#2e5797]/10 px-8 py-4 text-lg"
              onClick={() => document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Read Reviews
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 text-center bg-card/50 backdrop-blur-sm border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(46,87,151,0.2)]">
                <stat.icon className="h-12 w-12 text-[#2e5797] mx-auto mb-4" />
                <div className="text-3xl font-bold text-[#2e5797] mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
              User Stories
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Real Feedback from Real Users
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Discover how Ascendia has transformed writing workflows across industries
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6 bg-card/50 backdrop-blur-sm border-[#2e5797]/20 hover:border-[#2e5797]/40 transition-all duration-300 hover:scale-105 group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#2e5797] to-[#4a7bc8] rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{testimonial.name}</h4>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    <p className="text-xs text-[#2e5797]">{testimonial.company}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < testimonial.rating ? 'text-yellow-500 fill-current' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>

                <Quote className="h-6 w-6 text-[#2e5797]/40 mb-2" />
                <p className="text-muted-foreground leading-relaxed text-sm group-hover:text-foreground transition-colors">
                  {testimonial.text}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
              Success Stories
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Transformative Results
              </span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-[#2e5797]">Content Marketing Team</h3>
              <p className="text-lg text-muted-foreground mb-6">
                A leading SaaS company reduced their content creation time by 60% while
                maintaining brand voice consistency across all writers.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#2e5797]" />
                  <span>60% faster content production</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#2e5797]" />
                  <span>100% brand voice consistency</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#2e5797]" />
                  <span>25% increase in engagement</span>
                </div>
              </div>
            </div>
            <Card className="p-8 bg-gradient-to-br from-[#2e5797]/10 to-[#1a3d6b]/10 border-[#2e5797]/20">
              <div className="text-center">
                <TrendingUp className="h-16 w-16 text-[#2e5797] mx-auto mb-4" />
                <div className="text-4xl font-bold text-[#2e5797] mb-2">60%</div>
                <div className="text-muted-foreground">Faster Content Creation</div>
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Card className="p-8 bg-gradient-to-br from-[#4a7bc8]/10 to-[#6b8dd6]/10 border-[#4a7bc8]/20 lg:order-1">
              <div className="text-center">
                <Award className="h-16 w-16 text-[#4a7bc8] mx-auto mb-4" />
                <div className="text-4xl font-bold text-[#4a7bc8] mb-2">95%</div>
                <div className="text-muted-foreground">Accuracy Improvement</div>
              </div>
            </Card>
            <div className="lg:order-2">
              <h3 className="text-2xl font-bold mb-6 text-[#4a7bc8]">Academic Research Team</h3>
              <p className="text-lg text-muted-foreground mb-6">
                A university research department improved their publication acceptance rate
                by enhancing clarity while preserving academic rigor.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#4a7bc8]" />
                  <span>95% improvement in clarity scores</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#4a7bc8]" />
                  <span>40% higher acceptance rates</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#4a7bc8]" />
                  <span>Academic voice preserved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-20 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <Badge className="mb-4 bg-[#2e5797]/10 text-[#2e5797] border-[#2e5797]/30">
                Get in Touch
              </Badge>
              <h2 className="text-4xl font-bold mb-6">
                <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                  Share Your Feedback
                </span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                We'd love to hear about your experience with Ascendia. Your feedback helps us
                continue improving and serving writers worldwide.
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2e5797]/20 rounded-lg flex items-center justify-center">
                    <Mail className="h-6 w-6 text-[#2e5797]" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Email Us</h4>
                    <p className="text-muted-foreground">feedback@ascendia.ai</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2e5797]/20 rounded-lg flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-[#2e5797]" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Live Chat</h4>
                    <p className="text-muted-foreground">Available 24/7 in the app</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2e5797]/20 rounded-lg flex items-center justify-center">
                    <Globe className="h-6 w-6 text-[#2e5797]" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Community</h4>
                    <p className="text-muted-foreground">Join our Discord community</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback Form */}
            <Card className="p-8 bg-card/50 backdrop-blur-sm border-[#2e5797]/20">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-[#2e5797]/20 rounded-lg bg-background/50 focus:border-[#2e5797] focus:outline-none transition-colors"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-[#2e5797]/20 rounded-lg bg-background/50 focus:border-[#2e5797] focus:outline-none transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2 border border-[#2e5797]/20 rounded-lg bg-background/50 focus:border-[#2e5797] focus:outline-none transition-colors"
                    placeholder="Your company (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-[#2e5797]/20 rounded-lg bg-background/50 focus:border-[#2e5797] focus:outline-none transition-colors"
                  >
                    <option value="general">General Feedback</option>
                    <option value="feature">Feature Request</option>
                    <option value="bug">Bug Report</option>
                    <option value="testimonial">Testimonial</option>
                    <option value="support">Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Rating</label>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-8 w-8 cursor-pointer transition-colors ${
                          i < selectedRating ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-400'
                        }`}
                        onClick={() => setSelectedRating(i + 1)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 border border-[#2e5797]/20 rounded-lg bg-background/50 focus:border-[#2e5797] focus:outline-none transition-colors resize-none"
                    placeholder="Share your experience, suggestions, or feedback..."
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold py-3"
                >
                  Send Feedback
                  <Send className="ml-2 h-5 w-5" />
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Join Our Community of Writers
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Experience the writing enhancement tool that's trusted by thousands of
              professionals, creators, and teams worldwide.
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
                Watch Demo
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