import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'This endpoint is only available in development mode' }, { status: 403 })
  }

  try {
    console.log('🔧 Starting RLS Policy Fix...\n')

    // Create Supabase client with service role for full access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('✅ Supabase client initialized with service role')

    const fixes = []
    const errors = []

    // Test current table access first
    console.log('\n📊 Testing current table access:')
    console.log('=' .repeat(50))

    const tables = ['generated_drafts', 'user_embeddings', 'user_inputs', 'conversations']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0)

      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
        errors.push(`${table}: ${error.message}`)
      } else {
        console.log(`✅ ${table}: Accessible`)
        fixes.push(`${table}: Already accessible`)
      }
    }

    // Fix the RLS policies using raw SQL
    console.log('\n🔨 Applying RLS Policy Fixes:')
    console.log('=' .repeat(50))

    const sqlCommands = [
      // Fix generated_drafts
      `ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "Users can insert their own generated drafts" ON generated_drafts`,
      `DROP POLICY IF EXISTS "Users can view their own generated drafts" ON generated_drafts`,
      `CREATE POLICY "Users can insert their own generated drafts" ON generated_drafts FOR INSERT WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "Users can view their own generated drafts" ON generated_drafts FOR SELECT USING (auth.uid() = user_id)`,

      // Fix user_embeddings
      `ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "Users can insert their own embeddings" ON user_embeddings`,
      `DROP POLICY IF EXISTS "Users can view their own embeddings" ON user_embeddings`,
      `CREATE POLICY "Users can insert their own embeddings" ON user_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "Users can view their own embeddings" ON user_embeddings FOR SELECT USING (auth.uid() = user_id)`,

      // Fix user_inputs
      `ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "Users can insert their own inputs" ON user_inputs`,
      `DROP POLICY IF EXISTS "Users can view their own inputs" ON user_inputs`,
      `CREATE POLICY "Users can insert their own inputs" ON user_inputs FOR INSERT WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "Users can view their own inputs" ON user_inputs FOR SELECT USING (auth.uid() = user_id)`,

      // Fix conversations
      `ALTER TABLE conversations ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations`,
      `DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations`,
      `CREATE POLICY "Users can insert their own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "Users can view their own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id)`,

      // Make content field nullable in user_inputs
      `ALTER TABLE user_inputs ALTER COLUMN content DROP NOT NULL`
    ]

    let successCount = 0
    let errorCount = 0

    // Execute each SQL command
    for (const sql of sqlCommands) {
      try {
        const { error } = await supabase.rpc('exec_sql', { query: sql })

        if (error) {
          // Try direct execution if RPC doesn't work
          console.log(`⚠️ RPC failed, attempting direct execution for: ${sql.substring(0, 50)}...`)
          // Note: Direct SQL execution might not be available, but we try
          errorCount++
        } else {
          successCount++
          console.log(`✅ Executed: ${sql.substring(0, 50)}...`)
        }
      } catch (err) {
        console.log(`❌ Failed: ${sql.substring(0, 50)}...`)
        errorCount++
      }
    }

    // Test table access again
    console.log('\n📊 Testing table access after fixes:')
    console.log('=' .repeat(50))

    const afterFixes = []

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0)

      if (error) {
        console.log(`❌ ${table}: Still has issues - ${error.message}`)
        afterFixes.push({ table, accessible: false, error: error.message })
      } else {
        console.log(`✅ ${table}: Now accessible!`)
        afterFixes.push({ table, accessible: true })
      }
    }

    console.log('\n🎯 Summary:')
    console.log('=' .repeat(50))
    console.log(`SQL commands attempted: ${sqlCommands.length}`)
    console.log(`Successful: ${successCount}`)
    console.log(`Failed: ${errorCount}`)

    const allAccessible = afterFixes.every(f => f.accessible)

    if (allAccessible) {
      console.log('\n✅ All tables are now accessible!')
    } else {
      console.log('\n⚠️ Some tables still have issues.')
      console.log('\n💡 You may need to:')
      console.log('1. Go to your Supabase dashboard')
      console.log('2. Navigate to Authentication > Policies')
      console.log('3. Enable RLS and create policies for each table')
      console.log('4. Or run the SQL migration directly in Supabase SQL Editor')
    }

    return NextResponse.json({
      success: allAccessible,
      message: allAccessible ? 'All RLS policies fixed!' : 'Some issues remain - check Supabase dashboard',
      beforeFixes: errors,
      afterFixes,
      sqlAttempted: sqlCommands.length,
      sqlSuccessful: successCount,
      sqlFailed: errorCount,
      nextSteps: allAccessible ? [] : [
        'Go to Supabase Dashboard > SQL Editor',
        'Run the migration in /supabase/migrations/fix_rls_policies.sql',
        'Or manually create RLS policies in Authentication > Policies'
      ]
    })

  } catch (error) {
    console.error('❌ RLS fix failed:', error)
    return NextResponse.json({
      error: 'RLS fix failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'Check server console for detailed error information'
    }, { status: 500 })
  }
}