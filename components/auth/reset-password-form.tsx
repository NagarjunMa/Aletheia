'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationErrors {
  password?: string
  confirmPassword?: string
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  const router = useRouter()
  const searchParams = useSearchParams()

  // Check if we have the necessary tokens from the URL
  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setError('Invalid reset link. Please request a new password reset.')
    }
  }, [searchParams])

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    // Password validation
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password),
    ]

    strength = checks.filter(Boolean).length
    return { strength, checks }
  }

  const { strength, checks } = getPasswordStrength(password)

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Password Updated</h3>
          <p className="text-muted-foreground mt-2">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
        </div>
        <Button
          onClick={() => router.push('/auth/login')}
        >
          Continue to Sign In
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your new password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (validationErrors.password) {
                setValidationErrors(prev => ({ ...prev, password: undefined }))
              }
            }}
            className={cn(
              "pl-10 pr-10",
              validationErrors.password && "border-destructive focus-visible:ring-destructive"
            )}
            required
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>

        {password && (
          <div className="space-y-2">
            <div className="flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded",
                    i < strength
                      ? strength <= 2
                        ? "bg-red-500"
                        : strength <= 3
                        ? "bg-yellow-500"
                        : "bg-green-500"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
            <ul className="text-xs space-y-1">
              <li className={cn(checks[0] ? "text-green-600" : "text-muted-foreground")}>
                ✓ At least 8 characters
              </li>
              <li className={cn(checks[1] ? "text-green-600" : "text-muted-foreground")}>
                ✓ One lowercase letter
              </li>
              <li className={cn(checks[2] ? "text-green-600" : "text-muted-foreground")}>
                ✓ One uppercase letter
              </li>
              <li className={cn(checks[3] ? "text-green-600" : "text-muted-foreground")}>
                ✓ One number
              </li>
            </ul>
          </div>
        )}

        {validationErrors.password && (
          <p className="text-sm text-destructive">{validationErrors.password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (validationErrors.confirmPassword) {
                setValidationErrors(prev => ({ ...prev, confirmPassword: undefined }))
              }
            }}
            className={cn(
              "pl-10 pr-10",
              validationErrors.confirmPassword && "border-destructive focus-visible:ring-destructive"
            )}
            required
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isLoading}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
        {validationErrors.confirmPassword && (
          <p className="text-sm text-destructive">{validationErrors.confirmPassword}</p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || !password || !confirmPassword}
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Updating password...
          </div>
        ) : (
          'Update Password'
        )}
      </Button>
    </form>
  )
}