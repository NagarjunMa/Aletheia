// Supabase Initialization and Setup
// Created: December 7, 2024
// Purpose: Initialize Supabase and verify setup

import { createClient } from './server'
import { createServiceClient } from './server'

export async function initializeSupabase() {
  try {
    const supabase = createClient()

    // Test basic connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.error('Supabase connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connection successful')
    return true
  } catch (error) {
    console.error('Failed to initialize Supabase:', error)
    return false
  }
}

export async function verifyDatabaseSchema() {
  try {
    const supabase = createServiceClient()

    // Check if required tables exist
    const tables = ['profiles', 'conversations', 'user_inputs', 'generated_drafts']

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.error(`❌ Table '${table}' not found or accessible:`, error.message)
        return false
      }
    }

    console.log('✅ All required database tables are accessible')
    return true
  } catch (error) {
    console.error('Database schema verification failed:', error)
    return false
  }
}

export async function verifyRLSPolicies() {
  try {
    const supabase = createClient()

    // Try to access data without authentication (should fail)
    const { error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (error && error.message.includes('RLS')) {
      console.log('✅ Row Level Security policies are active')
      return true
    }

    console.warn('⚠️  RLS policies may not be properly configured')
    return false
  } catch (error) {
    console.error('RLS verification failed:', error)
    return false
  }
}

export async function setupSupabaseProject() {
  console.log('🚀 Setting up Supabase project...')

  const steps = [
    { name: 'Testing connection', fn: initializeSupabase },
    { name: 'Verifying database schema', fn: verifyDatabaseSchema },
    { name: 'Checking RLS policies', fn: verifyRLSPolicies },
  ]

  const results = []

  for (const step of steps) {
    console.log(`\n📋 ${step.name}...`)
    const success = await step.fn()
    results.push({ name: step.name, success })

    if (!success) {
      console.log(`❌ ${step.name} failed`)
    }
  }

  const allSuccessful = results.every(r => r.success)

  if (allSuccessful) {
    console.log('\n🎉 Supabase setup completed successfully!')
  } else {
    console.log('\n⚠️  Some setup steps failed. Please check the configuration.')
  }

  return allSuccessful
}