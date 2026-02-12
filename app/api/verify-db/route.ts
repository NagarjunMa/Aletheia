import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  // Only run in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'This endpoint is only available in development mode' }, { status: 403 })
  }

  try {
    console.log('🔍 Starting Supabase Database Verification...\n')

    // Create Supabase client with service role for full access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('✅ Supabase client initialized')
    console.log(`📡 Connected to: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)

    const verification = {
      generated_drafts: { exists: false, columns: [] as string[], error: null },
      user_embeddings: { exists: false, columns: [] as string[], error: null },
      conversations: { exists: false, columns: [] as string[], error: null },
      usage_analytics: { exists: false, columns: [] as string[], error: null },
      user_inputs: { exists: false, columns: [] as string[], error: null },
      profiles: { exists: false, columns: [] as string[], error: null }
    }

    // Test each table by trying to select from it
    const tablesToTest = [
      'generated_drafts',
      'user_embeddings',
      'conversations',
      'usage_analytics',
      'user_inputs',
      'profiles'
    ]

    console.log('🔎 Testing Table Existence and Structure:')
    console.log('=' .repeat(50))

    for (const tableName of tablesToTest) {
      try {
        // Try to select columns from the table (LIMIT 0 to avoid data)
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0)

        if (error) {
          console.log(`❌ Table "${tableName}": ${error.message}`)
          verification[tableName as keyof typeof verification].error = error.message
        } else {
          console.log(`✅ Table "${tableName}": EXISTS`)
          verification[tableName as keyof typeof verification].exists = true

          // Get the structure by doing a single select
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)

          if (sampleData && !sampleError) {
            const columns = Object.keys(sampleData[0] || {})
            verification[tableName as keyof typeof verification].columns = columns
            console.log(`   Columns: ${columns.join(', ')}`)
          }
        }
      } catch (err) {
        console.log(`❌ Table "${tableName}": ${err instanceof Error ? err.message : 'Unknown error'}`)
        verification[tableName as keyof typeof verification].error = err instanceof Error ? err.message : 'Unknown error'
      }
      console.log('')
    }

    // Specifically test the problematic columns we know about
    console.log('🔧 Checking Specific Column Issues:')
    console.log('=' .repeat(50))

    // Test generated_drafts specifically
    if (verification.generated_drafts.exists) {
      console.log('Checking generated_drafts columns:')
      const requiredColumns = ['id', 'user_input_id', 'user_id', 'content', 'draft_type', 'cpl_score']
      const actualColumns = verification.generated_drafts.columns

      requiredColumns.forEach(col => {
        const exists = actualColumns.includes(col)
        console.log(`   - ${col}: ${exists ? '✅' : '❌'}`)
      })
      console.log('')
    }

    // Test user_embeddings specifically
    if (verification.user_embeddings.exists) {
      console.log('Checking user_embeddings columns:')
      const requiredColumns = ['id', 'user_id', 'content', 'embedding', 'content_type', 'metadata']
      const actualColumns = verification.user_embeddings.columns

      requiredColumns.forEach(col => {
        const exists = actualColumns.includes(col)
        console.log(`   - ${col}: ${exists ? '✅' : '❌'}`)
      })
      console.log('')
    }

    // Test conversations specifically
    if (verification.conversations.exists) {
      console.log('Checking conversations columns:')
      const requiredColumns = ['id', 'user_id', 'title', 'category', 'created_at', 'updated_at', 'last_activity_at']
      const actualColumns = verification.conversations.columns

      requiredColumns.forEach(col => {
        const exists = actualColumns.includes(col)
        console.log(`   - ${col}: ${exists ? '✅' : '❌'}`)
      })
      console.log('')
    }

    console.log('🎯 Summary:')
    console.log('=' .repeat(50))

    const existingTables = Object.entries(verification).filter(([_, info]) => info.exists).length
    console.log(`Tables found: ${existingTables}/${tablesToTest.length}`)

    const issues: string[] = []
    Object.entries(verification).forEach(([tableName, info]) => {
      if (!info.exists) {
        issues.push(`${tableName} table missing or inaccessible`)
      }
    })

    if (issues.length === 0) {
      console.log('✅ All key tables are accessible!')
    } else {
      console.log('Issues found:')
      issues.forEach(issue => console.log(`- ${issue}`))
    }

    console.log('\n💡 This verification shows which tables are accessible via Supabase REST API')
    console.log('💡 The 400 errors in streaming are likely due to:')
    console.log('  1. Column name mismatches')
    console.log('  2. Foreign key constraint violations')
    console.log('  3. Row Level Security (RLS) policies')
    console.log('')

    return NextResponse.json({
      success: true,
      verification,
      tablesFound: existingTables,
      totalTables: tablesToTest.length,
      issues,
      message: 'Database verification completed. Check server console for detailed output.'
    })

  } catch (error) {
    console.error('❌ Database verification failed:', error)

    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }

    console.log('\n💡 Check your environment variables:')
    console.log('- NEXT_PUBLIC_SUPABASE_URL')
    console.log('- SUPABASE_SERVICE_ROLE_KEY')

    return NextResponse.json({
      error: 'Database verification failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'Check server console for detailed error information'
    }, { status: 500 })
  }
}