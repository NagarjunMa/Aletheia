#!/usr/bin/env tsx

// Startup Validation Script
// Created: January 2025
// Purpose: Validate system health during development startup

import { config } from 'dotenv'
import { performHealthCheck } from '../lib/config/validation'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function main() {
  console.log('🚀 Starting Ascendia System Validation...\n')

  try {
    // Perform comprehensive health check
    const result = await performHealthCheck()

    console.log('\n📊 HEALTH CHECK RESULTS:')
    console.log('========================')

    // Environment Status
    console.log(`🔧 Environment: ${result.environment.isValid ? '✅ VALID' : '❌ INVALID'}`)
    if (result.environment.errors.length > 0) {
      console.log('   Errors:')
      result.environment.errors.forEach(error => console.log(`   - ${error}`))
    }
    if (result.environment.warnings.length > 0) {
      console.log('   Warnings:')
      result.environment.warnings.forEach(warning => console.log(`   - ${warning}`))
    }

    // Database Status
    console.log(`🗄️ Database: ${result.database.isConnected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`)
    if (result.database.error) {
      console.log(`   Error: ${result.database.error}`)
    }
    if (result.database.latency) {
      console.log(`   Latency: ${result.database.latency}ms`)
    }
    console.log(`   Status: ${result.database.projectStatus.toUpperCase()}`)

    // Overall Status
    console.log(`\n🎯 Overall Health: ${result.overall.toUpperCase()}`)

    // Recommendations
    if (result.recommendations.length > 0) {
      console.log('\n📝 RECOMMENDATIONS:')
      result.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    }

    console.log('\n🔍 SYSTEM STATUS:')
    console.log('================')

    if (result.overall === 'healthy') {
      console.log('✅ System is ready for development')
      console.log('🌐 Server: http://localhost:3000')
      console.log('🗄️ Database: Connected and operational')
      console.log('⚙️ All dependencies resolved')
    } else if (result.overall === 'degraded') {
      console.log('⚠️  System has some issues but can continue')
      console.log('🌐 Server: http://localhost:3000 (limited functionality)')
      console.log('🗄️ Database: May have connectivity issues')
      console.log('⚙️ Some features may be unavailable')
    } else {
      console.log('❌ System has critical issues')
      console.log('🚨 Development server may not function properly')
      console.log('🛠️ Please resolve issues before continuing')
    }

    // Exit with appropriate code
    process.exit(result.overall === 'critical' ? 1 : 0)

  } catch (error) {
    console.error('❌ Startup validation failed:', error)
    console.log('\n🔧 TROUBLESHOOTING:')
    console.log('==================')
    console.log('1. Check your .env.local file exists and has valid values')
    console.log('2. Verify your Supabase project is active')
    console.log('3. Check your internet connection')
    console.log('4. Ensure all dependencies are installed (npm install)')

    process.exit(1)
  }
}

// Run validation if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { main as validateStartup }