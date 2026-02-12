# Supabase Vector Embeddings Setup Guide

This guide will help you connect Ascendia's vector embeddings system with Supabase.

## Prerequisites

- A Supabase account (free tier works fine)
- OpenAI API key for embeddings (we'll add this too)

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up/sign in with GitHub
4. Click "New Project"
5. Choose your organization
6. Set project details:
   - **Name**: `ascendia-dev` (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free (sufficient for development)

## Step 2: Get Your Supabase Credentials

Once your project is created:

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...` - keep this secret!)

3. Go to **Settings** → **Database**
4. Copy the **JWT Secret**

## Step 3: Update Your Environment Variables

Open your `.env.local` file and replace these values:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
SUPABASE_JWT_SECRET=your_actual_jwt_secret_here

# Add OpenAI API Key (required for embeddings)
OPENAI_API_KEY=sk-your_openai_api_key_here
```

## Step 4: Run Database Migrations

### Option A: Via Supabase SQL Editor (Recommended)

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of each migration file in order:

**First, enable pgvector:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

**Then run Migration 001:**
```sql
-- Copy the entire content of database/migrations/001_enable_pgvector.sql
-- Paste it into the SQL editor and run
```

**Run Migration 002:**
```sql
-- Copy the entire content of database/migrations/002_user_style_profiles.sql
-- Paste it into the SQL editor and run
```

**Run Migration 003:**
```sql
-- Copy the entire content of database/migrations/003_batch_processing_results.sql
-- Paste it into the SQL editor and run
```

### Option B: Via Command Line (Advanced)

If you prefer command line:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (get project-id from Supabase dashboard URL)
supabase link --project-ref your-project-id

# Run migrations
supabase db push
```

## Step 5: Set Up OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account or sign in
3. Go to **API keys** section
4. Create a new API key
5. Add it to your `.env.local`:

```bash
OPENAI_API_KEY=sk-your_actual_openai_api_key_here
```

## Step 6: Test the Connection

Restart your development server:

```bash
npm run dev
```

The application should now connect to Supabase successfully. You can test by:

1. Opening the browser console (F12)
2. Looking for any connection errors
3. The app should load without database-related errors

## Step 7: Verify Vector Tables

In Supabase dashboard, go to **Table Editor** and verify these tables exist:

- `user_embeddings` - Stores text embeddings with vector search
- `user_style_profiles` - Stores user voice/style profiles
- `batch_processing_results` - Tracks batch processing for cost optimization
- `profiles` - User profiles (created by Supabase Auth)
- `generated_drafts` - Generated content history

## Troubleshooting

### Common Issues:

1. **"relation 'user_embeddings' does not exist"**
   - Run the migrations in Supabase SQL Editor

2. **"extension 'vector' is not available"**
   - Run `CREATE EXTENSION IF NOT EXISTS vector;` in SQL Editor

3. **Connection errors**
   - Double-check your environment variables
   - Make sure there are no extra spaces in the keys

4. **OpenAI API errors**
   - Verify your OpenAI API key is correct
   - Check you have credits/billing set up in OpenAI

### Testing Vector Functionality:

Once everything is set up, you can test the vector features:

1. Try the CPL analysis on some text
2. Use the voice learning features
3. Generate dual drafts
4. Check the browser console for any errors

### Database Schema Verification:

Run this in Supabase SQL Editor to verify everything is set up:

```sql
-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_embeddings', 'user_style_profiles', 'batch_processing_results');

-- Test vector functionality
SELECT 1;
```

## Next Steps

Once connected, the application will automatically:

- Store user writing samples as vector embeddings
- Build voice profiles for style learning
- Use batch processing for cost optimization
- Provide real-time CPL analysis and suggestions

Your Ascendia app is now fully connected to Supabase with vector capabilities! 🚀