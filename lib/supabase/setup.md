# Supabase Setup Guide for Ascendia

## Overview
This guide provides complete instructions for setting up Supabase for the Ascendia project, including database schema deployment, authentication configuration, and Row-Level Security policies.

## Prerequisites
- Supabase account
- Supabase CLI installed (`npm install -g supabase`)
- Environment variables configured

## 1. Project Setup

### Create New Supabase Project
1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - Name: `ascendia-production` (or `ascendia-dev` for development)
   - Database Password: Generate a secure password
   - Region: Choose closest to your users
5. Wait for project creation (takes ~2 minutes)

### Get Project Credentials
After creation, get these values from Settings > API:
- Project URL
- Anon (public) key
- Service role key (keep secret!)

## 2. Environment Variables

Create/update your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Additional Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, update these in your deployment platform (Vercel, Railway, etc.)

## 3. Database Schema Deployment

### Method 1: Using Supabase Dashboard (Recommended for first-time setup)

1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy the entire contents of `lib/database/schema.sql`
4. Paste into the SQL editor
5. Click "Run" to execute

### Method 2: Using Supabase CLI

```bash
# Initialize Supabase in your project
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Run the schema migration
supabase db push --include-all

# Generate TypeScript types (optional, but recommended)
supabase gen types typescript --local > lib/database/generated-types.ts
```

## 4. Authentication Configuration

### Enable Authentication Providers

1. Go to Authentication > Providers in your Supabase dashboard

#### Email/Password Authentication
1. Ensure "Enable email confirmations" is checked
2. Configure email templates (see Email Templates section)

#### Google OAuth Setup
1. Click on "Google" provider
2. Enable the provider
3. Add your OAuth credentials:
   - Client ID: From Google Cloud Console
   - Client Secret: From Google Cloud Console
4. Add authorized redirect URIs:
   - Development: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Production: `https://your-domain.com/auth/callback`

### Google OAuth Setup (Detailed)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure OAuth consent screen first if prompted
6. Choose "Web application"
7. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://your-domain.com` (production)
8. Add authorized redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
9. Copy Client ID and Client Secret to Supabase

## 5. Email Templates

### Confirmation Email Template

Go to Authentication > Email Templates > Confirm signup:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Ascendia!</h1>
    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your Personalized Voice Agent</p>
  </div>

  <div style="padding: 30px 20px; background: white;">
    <h2 style="color: #333; margin-top: 0;">Confirm your email to get started</h2>

    <p style="color: #666; line-height: 1.6;">
      Thank you for joining Ascendia! We're excited to help you enhance your writing while preserving your unique voice.
    </p>

    <p style="color: #666; line-height: 1.6;">
      Click the button below to confirm your email address and start improving your writing:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}"
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                display: inline-block;">
        Confirm Email Address
      </a>
    </div>

    <p style="color: #999; font-size: 14px; line-height: 1.6;">
      If you didn't create an account with Ascendia, you can safely ignore this email.
    </p>

    <p style="color: #999; font-size: 14px; line-height: 1.6;">
      Having trouble? Copy and paste this link into your browser:<br>
      <span style="word-break: break-all;">{{ .ConfirmationURL }}</span>
    </p>
  </div>

  <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
    <p style="color: #666; margin: 0; font-size: 14px;">
      © 2024 Ascendia. All rights reserved.
    </p>
  </div>
</div>
```

### Password Reset Template

Go to Authentication > Email Templates > Reset password:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Ascendia Account Security</p>
  </div>

  <div style="padding: 30px 20px; background: white;">
    <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>

    <p style="color: #666; line-height: 1.6;">
      You requested to reset your password for your Ascendia account. Click the button below to set a new password:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}"
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                display: inline-block;">
        Reset Password
      </a>
    </div>

    <p style="color: #999; font-size: 14px; line-height: 1.6;">
      This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</div>
```

## 6. Row-Level Security Verification

After running the schema, verify RLS is working:

1. Go to Database > Tables in Supabase dashboard
2. For each table (profiles, conversations, user_inputs, generated_drafts):
   - Click on the table
   - Go to "RLS" tab
   - Verify policies are listed and enabled
3. Test with different user sessions to ensure isolation

## 7. Local Development Setup

For local development with Supabase CLI:

```bash
# Start local Supabase
supabase start

# Your local Supabase is now running at:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323

# Update .env.local for local development:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

## 8. Security Configuration

### API Settings
1. Go to Settings > API
2. Configure rate limiting:
   - Requests per second: 100 (adjust based on needs)
   - Anonymous requests: Enabled (for public pages)

### Database Settings
1. Go to Settings > Database
2. Enable Point in Time Recovery (PITR) for production
3. Configure automatic backups

## 9. Monitoring and Maintenance

### Enable Monitoring
1. Go to Observability
2. Set up alerts for:
   - High database CPU usage
   - Large number of failed requests
   - Storage usage approaching limits

### Regular Maintenance
- Review API usage patterns monthly
- Monitor storage growth
- Update Supabase when new versions are available
- Review and audit RLS policies quarterly

## 10. Testing the Setup

### Verify Database Connection

Create a test file to verify setup:

```typescript
// test-db-connection.ts
import { createClient } from './lib/supabase/server'

async function testConnection() {
  const supabase = createClient()

  // Test basic connection
  const { data, error } = await supabase
    .from('profiles')
    .select('count')

  if (error) {
    console.error('Database connection failed:', error)
    return false
  }

  console.log('Database connection successful!')
  return true
}
```

### Test Authentication Flow
1. Try registering a new account
2. Check email confirmation works
3. Test login/logout functionality
4. Verify RLS by trying to access another user's data

## 11. Production Checklist

Before deploying to production:

- [ ] Database schema deployed successfully
- [ ] RLS policies tested and working
- [ ] Authentication providers configured
- [ ] Email templates customized
- [ ] Environment variables set in production
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place
- [ ] API rate limits appropriate for expected load
- [ ] Security review completed

## Troubleshooting

### Common Issues

1. **Connection errors**: Check environment variables
2. **RLS blocking queries**: Verify user is authenticated
3. **Email not sending**: Check SMTP configuration
4. **OAuth errors**: Verify redirect URLs match exactly

### Support Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com/)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

---

This setup provides a production-ready Supabase configuration for the Ascendia project with proper security, authentication, and data isolation.