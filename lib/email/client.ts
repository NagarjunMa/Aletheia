import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const EMAIL_CONFIG = {
  from: 'Ascendia <noreply@yourdomain.com>', // Update with your verified domain
  replyTo: 'support@yourdomain.com',
  company: {
    name: 'Ascendia',
    tagline: 'Your Personalized Voice Agent',
    website: process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com',
    supportEmail: 'support@yourdomain.com'
  }
} as const