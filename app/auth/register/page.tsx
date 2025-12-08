import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { RegisterForm } from '@/components/auth/register-form'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Ascendia</h1>
          </Link>
          <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
          <p className="text-muted-foreground mt-2">
            Join Ascendia and start improving your writing with AI that learns your style
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Create your personalized voice agent account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}