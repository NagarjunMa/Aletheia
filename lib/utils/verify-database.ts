import { createClient } from '@supabase/supabase-js'

interface TableInfo {
  table_name: string
  columns: Array<{
    column_name: string
    data_type: string
    is_nullable: string
  }>
}

export async function verifyDatabaseTables(): Promise<void> {
  // Only run in development
  if (process.env.NODE_ENV !== 'development') {
    return
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

    // Query to get all tables and their columns
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError)
      return
    }

    console.log('📋 All Tables in Database:')
    console.log('=' .repeat(50))

    const tableInfos: TableInfo[] = []

    // For each table, get its columns
    for (const table of tablesData || []) {
      const tableName = table.table_name

      const { data: columnsData, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .order('ordinal_position')

      if (!columnsError && columnsData) {
        tableInfos.push({
          table_name: tableName,
          columns: columnsData
        })
      }
    }

    // Display all tables and their columns
    tableInfos.forEach((table, index) => {
      console.log(`${index + 1}. Table: "${table.table_name}"`)
      console.log(`   Columns (${table.columns.length}):`)

      table.columns.forEach((col, colIndex) => {
        const nullable = col.is_nullable === 'YES' ? 'nullable' : 'required'
        console.log(`   ${colIndex + 1}. ${col.column_name} (${col.data_type}) [${nullable}]`)
      })
      console.log('')
    })

    // Check specific tables that we know are causing issues
    console.log('🔎 Verification of Key Tables:')
    console.log('=' .repeat(50))

    // Check generated_drafts table
    const generatedDraftsTable = tableInfos.find(t => t.table_name === 'generated_drafts')
    if (generatedDraftsTable) {
      console.log('✅ Table "generated_drafts" EXISTS')
      console.log('   Key columns found:')
      const keyColumns = ['id', 'user_input_id', 'user_id', 'content', 'draft_type', 'cpl_score']
      keyColumns.forEach(col => {
        const found = generatedDraftsTable.columns.find(c => c.column_name === col)
        console.log(`   - ${col}: ${found ? '✅ EXISTS' : '❌ MISSING'}`)
      })
      console.log('')
    } else {
      console.log('❌ Table "generated_drafts" NOT FOUND')
    }

    // Check user_embeddings table
    const userEmbeddingsTable = tableInfos.find(t => t.table_name === 'user_embeddings')
    if (userEmbeddingsTable) {
      console.log('✅ Table "user_embeddings" EXISTS')
      console.log('   Key columns found:')
      const keyColumns = ['id', 'user_id', 'content', 'embedding', 'content_type', 'metadata']
      keyColumns.forEach(col => {
        const found = userEmbeddingsTable.columns.find(c => c.column_name === col)
        console.log(`   - ${col}: ${found ? '✅ EXISTS' : '❌ MISSING'}`)
      })
      console.log('')
    } else {
      console.log('❌ Table "user_embeddings" NOT FOUND')
    }

    // Check conversations table
    const conversationsTable = tableInfos.find(t => t.table_name === 'conversations')
    if (conversationsTable) {
      console.log('✅ Table "conversations" EXISTS')
      console.log('   Key columns found:')
      const keyColumns = ['id', 'user_id', 'title', 'category', 'created_at', 'updated_at', 'last_activity_at']
      keyColumns.forEach(col => {
        const found = conversationsTable.columns.find(c => c.column_name === col)
        console.log(`   - ${col}: ${found ? '✅ EXISTS' : '❌ MISSING'}`)
      })
      console.log('')
    } else {
      console.log('❌ Table "conversations" NOT FOUND')
    }

    // Check usage_analytics table
    const usageAnalyticsTable = tableInfos.find(t => t.table_name === 'usage_analytics')
    if (usageAnalyticsTable) {
      console.log('✅ Table "usage_analytics" EXISTS')
      console.log('   Key columns found:')
      const keyColumns = ['id', 'user_id', 'conversation_id', 'event_type', 'event_data']
      keyColumns.forEach(col => {
        const found = usageAnalyticsTable.columns.find(c => c.column_name === col)
        console.log(`   - ${col}: ${found ? '✅ EXISTS' : '❌ MISSING'}`)
      })
      console.log('')
    } else {
      console.log('❌ Table "usage_analytics" NOT FOUND')
    }

    console.log('🎯 Summary:')
    console.log('=' .repeat(50))
    console.log(`Total tables found: ${tableInfos.length}`)
    console.log(`Database verification completed successfully!`)
    console.log('')

    // Log to help with debugging the 400 errors
    console.log('💡 Next Steps to Fix 400 Errors:')
    console.log('1. Check the exact column names above')
    console.log('2. Update code to match actual database schema')
    console.log('3. Verify foreign key relationships work')
    console.log('')

  } catch (error) {
    console.error('❌ Database verification failed:', error)

    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }

    console.log('\n💡 Check your environment variables:')
    console.log('- NEXT_PUBLIC_SUPABASE_URL')
    console.log('- SUPABASE_SERVICE_ROLE_KEY')
  }
}

// Helper function to run verification and return results
export async function getDatabaseSchema(): Promise<TableInfo[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (tablesError) throw tablesError

    const tableInfos: TableInfo[] = []

    for (const table of tablesData || []) {
      const tableName = table.table_name

      const { data: columnsData, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .order('ordinal_position')

      if (!columnsError && columnsData) {
        tableInfos.push({
          table_name: tableName,
          columns: columnsData
        })
      }
    }

    return tableInfos
  } catch (error) {
    console.error('Error getting database schema:', error)
    return []
  }
}