// Environment Validation and Configuration Health Checks
// Created: January 2025
// Purpose: Validate environment variables and database connectivity

import { createClient } from '@supabase/supabase-js'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  details: Record<string, unknown>
}

export interface SupabaseHealth {
  isConnected: boolean
  projectStatus: 'active' | 'paused' | 'error' | 'unknown'
  latency?: number
  error?: string
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required environment variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY'
  ]

  // Optional but recommended
  const optional = [
    'OPENAI_API_KEY',
    'NEXTAUTH_URL'
  ]

  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`)
    } else if (process.env[key] === 'your_key_here' || process.env[key]?.includes('your_')) {
      errors.push(`Environment variable ${key} contains placeholder value`)
    }
  }

  // Check optional variables
  for (const key of optional) {
    if (!process.env[key] || process.env[key]?.includes('your_')) {
      warnings.push(`Optional environment variable ${key} not configured`)
    }
  }

  // Validate URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[a-z0-9]{20}\.supabase\.co$/)) {
    errors.push('Invalid Supabase URL format. Expected: https://[project-id].supabase.co')
  }

  // Validate API key format
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey && !apiKey.startsWith('sk-ant-api03-')) {
    errors.push('Invalid Anthropic API key format. Expected to start with: sk-ant-api03-')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    details: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      optionalVarsCount: optional.filter(key => !!process.env[key]).length
    }
  }
}

/**
 * Test Supabase connectivity with retry logic
 */
export async function testSupabaseConnection(retries = 3): Promise<SupabaseHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return {
      isConnected: false,
      projectStatus: 'error',
      error: 'Missing Supabase configuration'
    }
  }

  // Create test client
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: {
        'x-application-name': 'ascendia-health-check'
      }
    }
  })

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Testing Supabase connection (attempt ${attempt}/${retries})...`)

      const startTime = Date.now()

      // Test basic connection with simple query
      const { error, data } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .maybeSingle()

      const latency = Date.now() - startTime

      if (error) {
        // Check for specific error types
        if (error.message.includes('relation "profiles" does not exist')) {
          return {
            isConnected: true,
            projectStatus: 'active',
            latency,
            error: 'Database schema not initialized. Run setup scripts.'
          }
        }

        if (error.message.includes('JWT')) {
          return {
            isConnected: false,
            projectStatus: 'error',
            error: 'Invalid API key or JWT configuration'
          }
        }

        throw error
      }

      return {
        isConnected: true,
        projectStatus: 'active',
        latency
      }

    } catch (error) {
      console.error(`Supabase connection attempt ${attempt} failed:`, error)

      if (attempt === retries) {
        // Check if it's a DNS issue
        if (error instanceof Error) {
          if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            return {
              isConnected: false,
              projectStatus: 'error',
              error: `DNS resolution failed for ${url}. Check if the project exists or your network connection.`
            }
          }

          if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
            return {
              isConnected: false,
              projectStatus: 'error',
              error: 'Network error. Check your internet connection or firewall settings.'
            }
          }

          if (error.message.includes('timeout')) {
            return {
              isConnected: false,
              projectStatus: 'error',
              error: 'Connection timeout. The Supabase project might be paused or overloaded.'
            }
          }
        }

        return {
          isConnected: false,
          projectStatus: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown connection error'
        }
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  return {
    isConnected: false,
    projectStatus: 'unknown',
    error: 'All retry attempts failed'
  }
}

/**
 * Comprehensive system health check
 */
export async function performHealthCheck(): Promise<{
  environment: ValidationResult
  database: SupabaseHealth
  overall: 'healthy' | 'degraded' | 'critical'
  recommendations: string[]
}> {
  console.log('🔍 Performing system health check...')

  // Check environment variables
  const environment = validateEnvironment()
  console.log('📋 Environment validation:', environment.isValid ? '✅ PASSED' : '❌ FAILED')

  // Test database connectivity
  const database = await testSupabaseConnection()
  console.log('🗄️ Database connectivity:', database.isConnected ? '✅ CONNECTED' : '❌ FAILED')

  // Generate recommendations
  const recommendations: string[] = []

  if (!environment.isValid) {
    recommendations.push('Fix environment variable configuration')
    for (const error of environment.errors) {
      recommendations.push(`  - ${error}`)
    }
  }

  if (!database.isConnected) {
    recommendations.push('Resolve database connectivity issues')
    if (database.error) {
      recommendations.push(`  - ${database.error}`)
    }
  }

  if (environment.warnings.length > 0) {
    recommendations.push('Consider configuring optional services for full functionality')
  }

  if (database.latency && database.latency > 1000) {
    recommendations.push('Database latency is high. Consider optimizing queries or checking network.')
  }

  // Determine overall health
  let overall: 'healthy' | 'degraded' | 'critical'

  if (!environment.isValid || !database.isConnected) {
    overall = 'critical'
  } else if (environment.warnings.length > 2 || (database.latency && database.latency > 500)) {
    overall = 'degraded'
  } else {
    overall = 'healthy'
  }

  console.log(`🎯 Overall system health: ${overall.toUpperCase()}`)

  return {
    environment,
    database,
    overall,
    recommendations
  }
}

/**
 * Development startup validation
 */
export async function validateStartup(): Promise<boolean> {
  try {
    const health = await performHealthCheck()

    if (health.overall === 'critical') {
      console.error('❌ CRITICAL: System health check failed')
      console.error('📝 Recommendations:')
      for (const rec of health.recommendations) {
        console.error(`   ${rec}`)
      }
      return false
    }

    if (health.overall === 'degraded') {
      console.warn('⚠️  DEGRADED: System has some issues but can continue')
      console.warn('📝 Recommendations:')
      for (const rec of health.recommendations) {
        console.warn(`   ${rec}`)
      }
    }

    console.log('✅ System startup validation passed')
    return true

  } catch (error) {
    console.error('❌ Health check failed:', error)
    return false
  }
}