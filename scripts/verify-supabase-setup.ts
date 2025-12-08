#!/usr/bin/env tsx

// Supabase Setup Verification Script
// Created: December 7, 2024
// Purpose: Verify that Supabase is properly configured and accessible

import { setupSupabaseProject } from '@/lib/supabase/init'

async function main() {
  console.log('🔧 Verifying Supabase Setup for Ascendia')
  console.log('=====================================')

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  console.log('\n📋 Checking environment variables...')
  let envVarsMissing = false

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.log(`❌ Missing environment variable: ${envVar}`)
      envVarsMissing = true
    } else {
      console.log(`✅ Found ${envVar}`)
    }
  }

  if (envVarsMissing) {
    console.log('\n⚠️  Please set up your environment variables in .env.local')
    console.log('📖 See .env.example for reference')
    process.exit(1)
  }

  // Run Supabase setup verification
  const setupSuccess = await setupSupabaseProject()

  if (setupSuccess) {
    console.log('\n🎉 Supabase is properly configured!')
    console.log('\n📝 Next steps:')
    console.log('1. Deploy your database schema using the Supabase dashboard')
    console.log('2. Configure authentication providers if needed')
    console.log('3. Set up your custom email templates')
    console.log('4. Test the authentication flow')
    console.log('\n📖 See lib/supabase/setup.md for detailed instructions')
  } else {
    console.log('\n❌ Supabase setup verification failed')
    console.log('📖 Please check lib/supabase/setup.md for troubleshooting')
    process.exit(1)
  }
}

// Run the verification
main().catch((error) => {
  console.error('❌ Verification script failed:', error)
  process.exit(1)
})