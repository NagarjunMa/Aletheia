#!/usr/bin/env tsx

/**
 * Production Deployment Script
 *
 * Automated production deployment with comprehensive validation
 * - Environment verification
 * - Database migration validation
 * - Health check verification
 * - Monitoring system activation
 * - Performance validation
 */

import { createClient } from '@supabase/supabase-js'
import { monitoringSystem } from '../lib/monitoring'
import { productionConfig, env, isProduction } from '../lib/config/production'

interface DeploymentStep {
  name: string
  description: string
  execute: () => Promise<boolean>
  required: boolean
}

class ProductionDeployment {
  private startTime = Date.now()
  private completedSteps: string[] = []
  private failedSteps: string[] = []

  async deploy(): Promise<boolean> {
    console.log('🚀 Starting Ascendia Production Deployment...')
    console.log(`📅 Deployment Time: ${new Date().toISOString()}`)
    console.log(`🌍 Environment: ${env.NODE_ENV}`)
    console.log(`🏗️ Vercel Environment: ${env.VERCEL_ENV || 'local'}`)

    const steps: DeploymentStep[] = [
      {
        name: 'environment_validation',
        description: 'Validate environment variables',
        execute: this.validateEnvironment.bind(this),
        required: true
      },
      {
        name: 'database_connectivity',
        description: 'Test database connectivity',
        execute: this.validateDatabase.bind(this),
        required: true
      },
      {
        name: 'database_schema',
        description: 'Validate database schema',
        execute: this.validateDatabaseSchema.bind(this),
        required: true
      },
      {
        name: 'monitoring_system',
        description: 'Initialize monitoring system',
        execute: this.initializeMonitoring.bind(this),
        required: true
      },
      {
        name: 'health_check',
        description: 'Verify health check endpoint',
        execute: this.validateHealthCheck.bind(this),
        required: true
      },
      {
        name: 'ai_services',
        description: 'Validate AI service configuration',
        execute: this.validateAIServices.bind(this),
        required: true
      },
      {
        name: 'performance_test',
        description: 'Run basic performance tests',
        execute: this.validatePerformance.bind(this),
        required: false
      },
      {
        name: 'security_validation',
        description: 'Validate security configuration',
        execute: this.validateSecurity.bind(this),
        required: true
      }
    ]

    console.log(`📝 Deployment includes ${steps.length} steps (${steps.filter(s => s.required).length} required)`)
    console.log('')

    let allRequiredPassed = true

    for (const step of steps) {
      const stepStart = Date.now()
      console.log(`⏳ Executing: ${step.description}...`)

      try {
        const success = await step.execute()
        const duration = Date.now() - stepStart

        if (success) {
          console.log(`✅ ${step.description} completed (${duration}ms)`)
          this.completedSteps.push(step.name)
        } else {
          const icon = step.required ? '❌' : '⚠️'
          console.log(`${icon} ${step.description} failed (${duration}ms)`)
          this.failedSteps.push(step.name)

          if (step.required) {
            allRequiredPassed = false
          }
        }
      } catch (error) {
        const duration = Date.now() - stepStart
        const icon = step.required ? '❌' : '⚠️'
        console.log(`${icon} ${step.description} threw error (${duration}ms):`, error)
        this.failedSteps.push(step.name)

        if (step.required) {
          allRequiredPassed = false
        }
      }

      console.log('')
    }

    // Deployment summary
    const totalDuration = Date.now() - this.startTime
    console.log('📊 DEPLOYMENT SUMMARY')
    console.log(`⏱️ Total Duration: ${totalDuration}ms`)
    console.log(`✅ Completed Steps: ${this.completedSteps.length}`)
    console.log(`❌ Failed Steps: ${this.failedSteps.length}`)

    if (allRequiredPassed) {
      console.log('🎉 Production deployment successful!')
      console.log('🌐 Application ready for production traffic')
      console.log('📊 Monitoring system active')
      console.log('🛡️ Security features enabled')
      return true
    } else {
      console.log('💥 Production deployment failed!')
      console.log('❌ Required steps failed:', this.failedSteps.join(', '))
      console.log('🚫 Application not ready for production')
      return false
    }
  }

  private async validateEnvironment(): Promise<boolean> {
    try {
      // Environment validation is done during import of production config
      console.log('🔍 Environment variables validated')
      console.log(`📡 Supabase URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`)
      console.log(`🤖 Anthropic API: ${env.ANTHROPIC_API_KEY ? 'Configured' : 'Missing'}`)
      console.log(`🚀 App URL: ${env.NEXT_PUBLIC_APP_URL || 'Not set'}`)
      return true
    } catch (error) {
      console.error('Environment validation failed:', error)
      return false
    }
  }

  private async validateDatabase(): Promise<boolean> {
    try {
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      )

      const { data, error } = await supabase
        .from('profiles')
        .select('count(*)')
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Database connectivity failed:', error)
        return false
      }

      console.log('🗄️ Database connectivity verified')
      return true
    } catch (error) {
      console.error('Database validation error:', error)
      return false
    }
  }

  private async validateDatabaseSchema(): Promise<boolean> {
    try {
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      )

      // Check for key tables
      const tables = [
        'profiles',
        'conversations',
        'user_inputs',
        'generated_drafts',
        'conversation_memory',
        'user_feedback',
        'usage_analytics',
        'production_metrics',
        'production_alerts'
      ]

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        if (error) {
          console.error(`Table ${table} not accessible:`, error)
          return false
        }
      }

      console.log(`📋 Database schema validated (${tables.length} tables)`)
      return true
    } catch (error) {
      console.error('Database schema validation error:', error)
      return false
    }
  }

  private async initializeMonitoring(): Promise<boolean> {
    try {
      if (!productionConfig.monitoring.enabled) {
        console.log('⚠️ Monitoring disabled in configuration')
        return !isProduction() // Only fail in production
      }

      await monitoringSystem.initialize()
      await monitoringSystem.start()

      const status = await monitoringSystem.getSystemStatus()
      console.log(`📊 Monitoring system status: ${status.status}`)
      console.log(`🔧 Active components: ${Object.keys(status.components).length}`)

      return status.status !== 'critical'
    } catch (error) {
      console.error('Monitoring initialization failed:', error)
      return false
    }
  }

  private async validateHealthCheck(): Promise<boolean> {
    try {
      const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const healthUrl = `${baseUrl}/api/health`

      console.log(`🔍 Testing health check: ${healthUrl}`)

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Ascendia-Deployment-Script' }
      })

      if (!response.ok) {
        console.error(`Health check failed: ${response.status} ${response.statusText}`)
        return false
      }

      const health = await response.json()
      console.log(`💚 Health status: ${health.status}`)
      console.log(`⏱️ Uptime: ${health.uptime}s`)

      return health.status !== 'unhealthy'
    } catch (error) {
      console.error('Health check validation failed:', error)
      return false
    }
  }

  private async validateAIServices(): Promise<boolean> {
    try {
      if (!env.ANTHROPIC_API_KEY) {
        console.error('Anthropic API key not configured')
        return false
      }

      console.log('🤖 Anthropic API key configured')
      console.log(`⚡ Parallel processing: ${productionConfig.features.enableParallelProcessing}`)
      console.log(`🧠 Memory engine: ${productionConfig.features.enableMemoryEngine}`)
      console.log(`🎨 Style RAG: ${productionConfig.features.enableStyleRAG}`)

      return true
    } catch (error) {
      console.error('AI services validation failed:', error)
      return false
    }
  }

  private async validatePerformance(): Promise<boolean> {
    try {
      console.log(`🚀 Max concurrent requests: ${productionConfig.ai.maxConcurrentRequests}`)
      console.log(`⏱️ Request timeout: ${productionConfig.ai.requestTimeout}ms`)
      console.log(`🗜️ Compression enabled: ${productionConfig.performance.enableCompression}`)
      console.log(`📦 CDN enabled: ${productionConfig.performance.enableCDN}`)

      // Basic performance validation (check if configuration is reasonable)
      const isValid = productionConfig.ai.maxConcurrentRequests > 0 &&
                     productionConfig.ai.requestTimeout > 0 &&
                     productionConfig.ai.requestTimeout < 60000

      if (!isValid) {
        console.error('Performance configuration is invalid')
        return false
      }

      console.log('⚡ Performance configuration validated')
      return true
    } catch (error) {
      console.error('Performance validation failed:', error)
      return false
    }
  }

  private async validateSecurity(): Promise<boolean> {
    try {
      console.log(`🛡️ Advanced validation: ${productionConfig.security.enableAdvancedValidation}`)
      console.log(`🚫 Prompt injection detection: ${productionConfig.security.enablePromptInjectionDetection}`)
      console.log(`🔒 Content safety: ${productionConfig.security.enableContentSafety}`)
      console.log(`⚡ Rate limiting: ${productionConfig.security.enableRateLimiting}`)
      console.log(`🛡️ DDoS protection: ${productionConfig.security.enableDDoSProtection}`)

      // Validate that security features are properly configured for production
      if (isProduction()) {
        const requiredSecurityFeatures = [
          productionConfig.security.enableAdvancedValidation,
          productionConfig.security.enablePromptInjectionDetection,
          productionConfig.security.enableRateLimiting
        ]

        if (requiredSecurityFeatures.some(feature => !feature)) {
          console.error('Required security features not enabled for production')
          return false
        }
      }

      console.log('🔐 Security configuration validated')
      return true
    } catch (error) {
      console.error('Security validation failed:', error)
      return false
    }
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployment = new ProductionDeployment()
  deployment.deploy().then(success => {
    process.exit(success ? 0 : 1)
  }).catch(error => {
    console.error('Deployment script failed:', error)
    process.exit(1)
  })
}

export default ProductionDeployment