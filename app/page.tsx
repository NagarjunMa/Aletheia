import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ArrowRight, Sparkles, User, Zap } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Ascendia</h1>
        </div>
        <nav className="hidden md:flex gap-6">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Login
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Your Personalized Voice Agent
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Advanced AI writing assistant that learns and adapts to your unique writing style
            while ensuring professional clarity and correctness.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Writing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">How Ascendia Works</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <User className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Learns Your Voice</CardTitle>
              <CardDescription>
                Ascendia adapts to your unique writing style using our Content Polish Level (CPL) system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Every interaction helps Ascendia understand your preferences, tone, and style better.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Dual Draft Generation</CardTitle>
              <CardDescription>
                Get two versions: grammar-fix only and adaptive polish that matches your style
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Choose between minimal corrections or fully polished content that sounds like you.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Real-time Streaming</CardTitle>
              <CardDescription>
                Watch your content improve in real-time with our streaming AI technology
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No waiting - see your improved content as it's being generated.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to enhance your writing?</h3>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of writers who trust Ascendia to preserve their voice while perfecting their content.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-6 w-6" />
            <span className="font-semibold">Ascendia</span>
          </div>
          <p>© 2024 Ascendia. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}