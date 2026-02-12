import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/login-form'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ascendia-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center mb-6">
            <Logo size="lg" />
          </Link>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-gray-200">
            Sign in to your account to continue creating professional content
          </p>
        </div>

        <Card className="bg-ascendia-gray border-ascendia-accent/20">
          <CardHeader>
            <CardTitle className="text-white">Sign In</CardTitle>
            <CardDescription className="text-gray-200">
              Enter your credentials to access your AI writing assistant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-200 mt-6">
          Don't have an account?{' '}
          <Link href="/auth/register" className="font-medium text-ascendia-accent hover:text-ascendia-accent-dim transition-colors">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  )
}