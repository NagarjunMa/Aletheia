import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { RegisterForm } from '@/components/auth/register-form'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ascendia-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center mb-6">
            <Logo size="lg" />
          </Link>
          <h2 className="text-2xl font-bold text-white mb-2">Create your account</h2>
          <p className="text-gray-200">
            Join Ascendia and start creating professional content with AI
          </p>
        </div>

        <Card className="bg-ascendia-gray border-ascendia-accent/20">
          <CardHeader>
            <CardTitle className="text-white">Sign Up</CardTitle>
            <CardDescription className="text-gray-200">
              Create your personalized AI writing assistant account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-200 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-ascendia-accent hover:text-ascendia-accent-dim transition-colors">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}