# Environment Setup Guide for Ascendia

This guide will help you set up all required environment variables and API keys for the Ascendia application.

## Required Environment Variables

### 🔗 Supabase Configuration (REQUIRED)

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for the project to be ready

2. **Get Supabase Credentials**
   - Go to Project Settings → API
   - Copy the following values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. **Set up Database Schema**
   - Go to Supabase SQL Editor
   - Run the `supabase-schema.sql` script provided in this project
   - This creates all necessary tables and RLS policies

### 🤖 AI Service APIs (REQUIRED)

#### Anthropic (Claude API)
1. **Get API Key**
   - Go to [console.anthropic.com](https://console.anthropic.com/)
   - Create account and get API key

```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-api-key-here
```

#### OpenAI (Required for Embeddings)
1. **Get API Key**
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create API key

```bash
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_ORG_ID=your_openai_org_id_here
```

### 🔐 Authentication (REQUIRED)

#### NextAuth Secret
Generate a secure secret for JWT signing:

```bash
# Generate using OpenSSL
openssl rand -base64 32

# Add to .env.local
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=http://localhost:3000
```

#### Supabase JWT Secret
1. Go to Supabase Project Settings → API → JWT Settings
2. Copy the JWT Secret

```bash
SUPABASE_JWT_SECRET=your_supabase_jwt_secret_here
```

## Optional Environment Variables

### 📧 Email Services (Optional)

#### Resend (Recommended)
```bash
RESEND_API_KEY=re_your_resend_api_key_here
```

#### SendGrid (Alternative)
```bash
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
```

### ☁️ File Storage (Optional)

#### AWS S3
```bash
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_s3_bucket_name
```

### 📊 Analytics & Monitoring (Optional)

#### Sentry (Error Tracking)
```bash
SENTRY_DSN=https://your-sentry-dsn@o123456.ingest.sentry.io/123456
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

#### PostHog (Analytics)
```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### ⚡ Performance & Caching (Optional)

#### Redis (Local)
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password_here
```

#### Upstash Redis (Cloud)
```bash
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token_here
```

## Quick Start Setup

1. **Copy the template**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in the REQUIRED variables**
   - Supabase credentials
   - Anthropic API key
   - OpenAI API key
   - NextAuth secret

3. **Set up the database**
   - Run the `supabase-schema.sql` in your Supabase SQL editor

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Testing Your Setup

### 1. Check Database Connection
- Visit `/auth/login` - should load without errors
- Database connection is working if auth pages load

### 2. Check AI APIs
- Try the chat functionality
- If API keys are correct, you should be able to generate content

### 3. Check Authentication
- Try registering a new account
- Login with the created account

## Environment Validation

The application will validate critical environment variables on startup. Check the console for any missing required variables.

## Security Notes

- Never commit `.env.local` to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Set up proper RLS policies in Supabase for production

## Troubleshooting

### Common Issues

1. **Supabase Connection Failed**
   - Check URL format (should include https://)
   - Verify anon key is correct
   - Ensure RLS policies are set up

2. **AI API Not Working**
   - Verify API keys are valid
   - Check API quotas and billing
   - Ensure correct environment variables

3. **Authentication Issues**
   - Verify NextAuth secret is set
   - Check Supabase JWT secret
   - Ensure auth callbacks are configured

For more help, check the application logs or contact support.