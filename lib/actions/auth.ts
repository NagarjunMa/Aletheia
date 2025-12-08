'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
})

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// Server action for email/password login
export async function signInWithEmail(formData: FormData) {
  const supabase = createClient()

  // Parse and validate form data
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const validatedData = loginSchema.safeParse(rawData)

  if (!validatedData.success) {
    return {
      error: validatedData.error.issues[0].message,
      success: false,
    }
  }

  const { email, password } = validatedData.data

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    if (data.user) {
      return {
        success: true,
        user: data.user,
      }
    }

    return {
      error: 'Sign in failed',
      success: false,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}

// Server action for email/password registration
export async function signUpWithEmail(formData: FormData) {
  const supabase = createClient()

  // Parse and validate form data
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    fullName: formData.get('fullName') as string,
  }

  const validatedData = registerSchema.safeParse(rawData)

  if (!validatedData.success) {
    return {
      error: validatedData.error.issues[0].message,
      success: false,
    }
  }

  const { email, password, fullName } = validatedData.data

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    if (data.user) {
      return {
        success: true,
        user: data.user,
        message: 'Please check your email to verify your account',
      }
    }

    return {
      error: 'Registration failed',
      success: false,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}

// Server action for Google OAuth
export async function signInWithGoogle() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    if (data.url) {
      redirect(data.url)
    }

    return {
      error: 'Failed to initiate Google OAuth',
      success: false,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}

// Server action for password reset
export async function resetPassword(formData: FormData) {
  const supabase = createClient()

  // Parse and validate form data
  const rawData = {
    email: formData.get('email') as string,
  }

  const validatedData = resetPasswordSchema.safeParse(rawData)

  if (!validatedData.success) {
    return {
      error: validatedData.error.issues[0].message,
      success: false,
    }
  }

  const { email } = validatedData.data

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    })

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.',
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}

// Server action for updating password (after reset)
export async function updatePassword(formData: FormData) {
  const supabase = createClient()

  const password = formData.get('password') as string

  if (!password || password.length < 8) {
    return {
      error: 'Password must be at least 8 characters',
      success: false,
    }
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    return {
      success: true,
      message: 'Password updated successfully',
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}

// Server action for sign out
export async function signOut() {
  const supabase = createClient()

  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}

// Server action to get current user
export async function getCurrentUser() {
  const supabase = createClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return {
        error: error.message,
        user: null,
      }
    }

    return {
      user,
      error: null,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      user: null,
    }
  }
}

// Server action to refresh session
export async function refreshSession() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.refreshSession()

    if (error) {
      return {
        error: error.message,
        success: false,
      }
    }

    return {
      success: true,
      session: data.session,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
      success: false,
    }
  }
}