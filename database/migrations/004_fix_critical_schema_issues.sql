-- Critical Schema Fixes Migration
-- Fixes table inconsistencies, field mismatches, and missing structures
-- Created: January 2025
-- Priority: CRITICAL - Run this migration immediately

BEGIN;

-- =============================================================================
-- 1. FIX TABLE STRUCTURE INCONSISTENCIES
-- =============================================================================

-- Check if we have duplicate draft tables and consolidate them
DO $$
BEGIN
    -- First, check if both tables exist and have data
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drafts')
    AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'generated_drafts') THEN

        RAISE NOTICE 'Found duplicate draft tables, consolidating...';

        -- Migrate any data from 'drafts' to 'generated_drafts' if needed
        -- Only migrate if drafts table has data that generated_drafts doesn't
        INSERT INTO generated_drafts (
            user_input_id,
            user_id,
            content,
            draft_type,
            cpl_score,
            is_accepted,
            user_feedback,
            user_edits,
            metadata,
            created_at,
            updated_at,
            thread_id,
            thread_message_id
        )
        SELECT
            d.user_input_id,
            d.user_id,
            d.content,
            CASE
                WHEN d.type = 'grammar_fix' THEN 'grammar_fix'::draft_type
                WHEN d.type = 'adaptive_polish' THEN 'adaptive_polish'::draft_type
                ELSE 'grammar_fix'::draft_type -- default fallback
            END,
            d.cpl_score,
            d.is_accepted,
            d.user_feedback,
            d.user_edits,
            d.metadata,
            d.created_at,
            d.updated_at,
            d.thread_id,
            d.thread_message_id
        FROM drafts d
        WHERE NOT EXISTS (
            SELECT 1 FROM generated_drafts gd
            WHERE gd.user_input_id = d.user_input_id
            AND gd.content = d.content
        );

        -- Get count of migrated records
        GET DIAGNOSTICS row_count = ROW_COUNT;
        RAISE NOTICE 'Migrated % records from drafts to generated_drafts', row_count;

        -- Now drop the duplicate drafts table
        DROP TABLE IF EXISTS drafts CASCADE;
        RAISE NOTICE 'Dropped duplicate drafts table';

    END IF;
END $$;

-- =============================================================================
-- 2. FIX MISSING COLUMNS IN EXISTING TABLES
-- =============================================================================

-- Fix usage_analytics table - add missing conversation_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_analytics'
        AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE usage_analytics ADD COLUMN conversation_id UUID;
        RAISE NOTICE 'Added conversation_id column to usage_analytics';
    END IF;
END $$;

-- Fix usage_analytics table - ensure event_type is properly named (not action_type)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_analytics'
        AND column_name = 'action_type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_analytics'
        AND column_name = 'event_type'
    ) THEN
        ALTER TABLE usage_analytics RENAME COLUMN action_type TO event_type;
        RAISE NOTICE 'Renamed action_type to event_type in usage_analytics';
    END IF;
END $$;

-- Fix generated_drafts table - ensure conversation_id exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'generated_drafts'
        AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE generated_drafts ADD COLUMN conversation_id UUID;
        RAISE NOTICE 'Added conversation_id column to generated_drafts';

        -- Populate conversation_id from user_inputs table
        UPDATE generated_drafts gd
        SET conversation_id = ui.conversation_id
        FROM user_inputs ui
        WHERE gd.user_input_id = ui.id
        AND gd.conversation_id IS NULL;

        RAISE NOTICE 'Populated conversation_id in generated_drafts from user_inputs';
    END IF;
END $$;

-- =============================================================================
-- 3. ENABLE ROW LEVEL SECURITY ON MISSING TABLES
-- =============================================================================

-- Enable RLS on drafts table if it still exists (shouldn't after migration above)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drafts') THEN
        ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on drafts table';
    END IF;
END $$;

-- Enable RLS on thread-related tables
ALTER TABLE IF EXISTS threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS thread_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS thread_folder_assignments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. ADD MISSING RLS POLICIES FOR THREAD SYSTEM
-- =============================================================================

-- Threads RLS policies
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own threads" ON threads;
    DROP POLICY IF EXISTS "Users can create own threads" ON threads;
    DROP POLICY IF EXISTS "Users can update own threads" ON threads;
    DROP POLICY IF EXISTS "Users can delete own threads" ON threads;

    -- Create new policies
    CREATE POLICY "Users can view own threads" ON threads
        FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "Users can create own threads" ON threads
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own threads" ON threads
        FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete own threads" ON threads
        FOR DELETE USING (auth.uid() = user_id);

    RAISE NOTICE 'Created RLS policies for threads table';
END $$;

-- Thread Messages RLS policies
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own thread messages" ON thread_messages;
    DROP POLICY IF EXISTS "Users can create own thread messages" ON thread_messages;
    DROP POLICY IF EXISTS "Users can update own thread messages" ON thread_messages;

    -- Create new policies
    CREATE POLICY "Users can view own thread messages" ON thread_messages
        FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "Users can create own thread messages" ON thread_messages
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own thread messages" ON thread_messages
        FOR UPDATE USING (auth.uid() = user_id);

    RAISE NOTICE 'Created RLS policies for thread_messages table';
END $$;

-- Thread Folders RLS policies
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own folders" ON thread_folders;
    DROP POLICY IF EXISTS "Users can create own folders" ON thread_folders;
    DROP POLICY IF EXISTS "Users can update own folders" ON thread_folders;
    DROP POLICY IF EXISTS "Users can delete own folders" ON thread_folders;

    -- Create new policies
    CREATE POLICY "Users can view own folders" ON thread_folders
        FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "Users can create own folders" ON thread_folders
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own folders" ON thread_folders
        FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete own folders" ON thread_folders
        FOR DELETE USING (auth.uid() = user_id);

    RAISE NOTICE 'Created RLS policies for thread_folders table';
END $$;

-- Thread Folder Assignments RLS policies
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own folder assignments" ON thread_folder_assignments;
    DROP POLICY IF EXISTS "Users can create own folder assignments" ON thread_folder_assignments;

    -- Create new policies
    CREATE POLICY "Users can view own folder assignments" ON thread_folder_assignments
        FOR SELECT USING (
            auth.uid() = assigned_by OR
            auth.uid() IN (
                SELECT t.user_id FROM threads t WHERE t.id = thread_id
            )
        );

    CREATE POLICY "Users can create own folder assignments" ON thread_folder_assignments
        FOR INSERT WITH CHECK (
            auth.uid() = assigned_by OR
            auth.uid() IN (
                SELECT t.user_id FROM threads t WHERE t.id = thread_id
            )
        );

    RAISE NOTICE 'Created RLS policies for thread_folder_assignments table';
END $$;

-- =============================================================================
-- 5. ADD MISSING FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add conversation_id foreign key to usage_analytics if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'usage_analytics_conversation_id_fkey'
    ) THEN
        ALTER TABLE usage_analytics
        ADD CONSTRAINT usage_analytics_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint for usage_analytics.conversation_id';
    END IF;
END $$;

-- Add conversation_id foreign key to generated_drafts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'generated_drafts_conversation_id_fkey'
    ) THEN
        ALTER TABLE generated_drafts
        ADD CONSTRAINT generated_drafts_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint for generated_drafts.conversation_id';
    END IF;
END $$;

-- =============================================================================
-- 6. ADD MISSING INDEXES FOR PERFORMANCE
-- =============================================================================

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_usage_analytics_conversation_id
    ON usage_analytics(conversation_id);

CREATE INDEX IF NOT EXISTS idx_generated_drafts_conversation_id
    ON generated_drafts(conversation_id);

-- Add indexes for thread system
CREATE INDEX IF NOT EXISTS idx_threads_user_id_active
    ON threads(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id_position
    ON thread_messages(thread_id, position);

CREATE INDEX IF NOT EXISTS idx_thread_folders_user_id_sort
    ON thread_folders(user_id, sort_order);

-- =============================================================================
-- 7. UPDATE EXISTING DATA TO FIX INCONSISTENCIES
-- =============================================================================

-- Update any NULL conversation_id values in generated_drafts
UPDATE generated_drafts gd
SET conversation_id = ui.conversation_id
FROM user_inputs ui
WHERE gd.user_input_id = ui.id
AND gd.conversation_id IS NULL;

-- Update any missing category values in conversations to use proper enum
UPDATE conversations
SET category = 'conversational'::conversation_category
WHERE category IS NULL;

-- =============================================================================
-- 8. CREATE MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================================================

-- Drop existing views to recreate with proper structure
DROP VIEW IF EXISTS user_dashboard_stats CASCADE;
DROP VIEW IF EXISTS conversation_details CASCADE;

-- Create improved user dashboard stats view
CREATE VIEW user_dashboard_stats AS
SELECT
    p.id as user_id,
    p.full_name,
    p.cpl_score,
    'free'::text as subscription_status, -- Default for now
    0 as monthly_api_usage, -- Default for now
    100 as monthly_limit, -- Default for now
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= NOW() - INTERVAL '7 days') as conversations_this_week,
    COUNT(DISTINCT gd.id) as total_drafts,
    COUNT(DISTINCT gd.id) FILTER (WHERE gd.created_at >= NOW() - INTERVAL '7 days') as drafts_this_week,
    COUNT(DISTINCT gd.id) FILTER (WHERE gd.is_accepted = true) as accepted_drafts,
    ROUND(AVG(gd.cpl_score), 2) as avg_cpl_score,
    0::bigint as total_tokens_used -- Default for now
FROM profiles p
LEFT JOIN conversations c ON p.id = c.user_id
LEFT JOIN generated_drafts gd ON p.id = gd.user_id
GROUP BY p.id, p.full_name, p.cpl_score;

-- Create improved conversation details view
CREATE VIEW conversation_details AS
SELECT
    c.*,
    COUNT(ui.id) as input_count,
    COUNT(gd.id) as draft_count,
    COUNT(gd.id) FILTER (WHERE gd.is_accepted = true) as accepted_drafts,
    COUNT(gd.id) FILTER (WHERE gd.is_accepted = false) as rejected_drafts,
    ROUND(AVG(gd.cpl_score), 2) as avg_cpl_score,
    0::bigint as total_tokens, -- Default for now
    MAX(gd.created_at) as last_draft_at
FROM conversations c
LEFT JOIN user_inputs ui ON c.id = ui.conversation_id
LEFT JOIN generated_drafts gd ON c.id = gd.conversation_id
GROUP BY c.id;

-- =============================================================================
-- 9. UPDATE SCHEMA VERSION TRACKING
-- =============================================================================

-- Insert migration record
INSERT INTO schema_migrations (version, description, checksum)
VALUES (
    '004_fix_critical_schema_issues',
    'Fixed table inconsistencies, field mismatches, enabled RLS, and improved data integrity',
    md5('critical_fixes_v1.0_2025-01')
) ON CONFLICT (version) DO UPDATE SET
    applied_at = NOW(),
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum;

COMMIT;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

SELECT
    'Critical schema fixes completed successfully!' as message,
    '✅ Table consolidation completed' as table_fixes,
    '✅ Missing columns added' as column_fixes,
    '✅ RLS policies enabled' as security_fixes,
    '✅ Foreign keys added' as integrity_fixes,
    '✅ Performance indexes created' as performance_fixes,
    '✅ Views updated' as view_fixes;