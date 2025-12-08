import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function AuthCodeErrorPage({ searchParams }: { searchParams: { message?: string } }) {
  const message = searchParams.message

  const getErrorMessage = (errorCode?: string) => {
    switch (errorCode) {
      case 'profile_creation_failed':
        return {
          title: 'Profile Creation Failed',
          description: 'We were unable to create your profile. Please try signing in again or contact support.',
        }
      case 'authentication_failed':
        return {
          title: 'Authentication Failed',
          description: 'We could not verify your credentials. Please try signing in again.',
        }
      default:
        return {
          title: 'Authentication Error',
          description: 'Something went wrong during the authentication process. Please try again.',
        }
    }
  }

  const { title, description } = getErrorMessage(message)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Ascendia</h1>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">{title}</CardTitle>
            <CardDescription className="text-center">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/auth/login">Try Again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          If you continue to experience issues, please{' '}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  )
}