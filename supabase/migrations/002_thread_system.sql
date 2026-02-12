-- =============================================================================
-- ASCENDIA THREAD SYSTEM MIGRATION
-- Version: 002
-- Date: January 2025
-- Description: Implements thread-based conversation system with folders
-- =============================================================================

-- Enable necessary extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- NEW TABLES FOR THREAD SYSTEM
-- =============================================================================

-- Thread folders table (categories for organizing threads)
CREATE TABLE IF NOT EXISTS public.thread_folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
    description TEXT CHECK (length(description) <= 500),
    icon TEXT, -- Font Awesome icon class
    color TEXT, -- Hex color for UI
    is_open BOOLEAN DEFAULT TRUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE NOT NULL, -- System-created folders
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT unique_user_folder_name UNIQUE (user_id, name)
);

-- Threads table (main conversation container)
CREATE TABLE IF NOT EXISTS public.threads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 200),
    description TEXT CHECK (length(description) <= 1000),

    -- Thread state
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,

    -- Categorization
    category TEXT DEFAULT 'conversational' CHECK (
        category IN ('instagram_post', 'linkedin', 'medium_article', 'email', 'conversational')
    ),
    folder_id UUID REFERENCES public.thread_folders(id) ON DELETE SET NULL,

    -- Metadata
    message_count INTEGER DEFAULT 0 CHECK (message_count >= 0),
    last_message_at TIMESTAMP WITH TIME ZONE,
    context JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- AI metrics
    total_drafts_generated INTEGER DEFAULT 0 CHECK (total_drafts_generated >= 0),
    average_cpl_score DECIMAL(5,2),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for threads table
CREATE INDEX IF NOT EXISTS idx_threads_user_active ON public.threads(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_threads_user_archived ON public.threads(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_threads_folder ON public.threads(folder_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_message ON public.threads(user_id, last_message_at DESC);

-- Thread messages table (individual messages within threads)
CREATE TABLE IF NOT EXISTS public.thread_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL CHECK (length(content) >= 1),

    -- Message state
    is_draft BOOLEAN DEFAULT FALSE NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,

    -- Metadata
    position INTEGER NOT NULL, -- Order within thread
    parent_message_id UUID REFERENCES public.thread_messages(id) ON DELETE SET NULL,
    edit_history JSONB DEFAULT '[]', -- Array of previous versions
    metadata JSONB DEFAULT '{}',

    -- AI processing
    processing_time_ms INTEGER CHECK (processing_time_ms >= 0),
    model_used TEXT,
    token_count INTEGER CHECK (token_count >= 0),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Ensure unique position per thread
    CONSTRAINT unique_thread_position UNIQUE (thread_id, position)
);

-- Create indexes for thread_messages table
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.thread_messages(thread_id, position);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.thread_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.thread_messages(thread_id, role);

-- Thread folder assignments (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.thread_folder_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE NOT NULL,
    folder_id UUID REFERENCES public.thread_folders(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    CONSTRAINT unique_thread_folder UNIQUE (thread_id, folder_id)
);

-- Create indexes for thread_folder_assignments table
CREATE INDEX IF NOT EXISTS idx_assignments_thread ON public.thread_folder_assignments(thread_id);
CREATE INDEX IF NOT EXISTS idx_assignments_folder ON public.thread_folder_assignments(folder_id);

-- =============================================================================
-- UPDATE EXISTING TABLES
-- =============================================================================

-- Add thread support to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_migrated BOOLEAN DEFAULT FALSE;

-- Add thread support to user_inputs table
ALTER TABLE public.user_inputs
ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS thread_message_id UUID REFERENCES public.thread_messages(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS message_position INTEGER;

-- Add thread support to generated_drafts table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'generated_drafts') THEN
        ALTER TABLE public.generated_drafts
        ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS thread_message_id UUID REFERENCES public.thread_messages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add thread support to drafts table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drafts') THEN
        ALTER TABLE public.drafts
        ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS thread_message_id UUID REFERENCES public.thread_messages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Thread folders indexes
CREATE INDEX IF NOT EXISTS idx_thread_folders_user ON public.thread_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_folders_default ON public.thread_folders(is_default);

-- Threads indexes
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON public.threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_category ON public.threads(category);
CREATE INDEX IF NOT EXISTS idx_threads_tags ON public.threads USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_threads_created ON public.threads(created_at DESC);

-- Thread messages indexes
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON public.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_user_id ON public.thread_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created ON public.thread_messages(created_at DESC);

-- Updated indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON public.conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_user_inputs_thread ON public.user_inputs(thread_id);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update timestamps (used by multiple triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Function to update thread message count
CREATE OR REPLACE FUNCTION update_thread_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE threads
        SET
            message_count = message_count + 1,
            last_message_at = NEW.created_at,
            updated_at = NOW()
        WHERE id = NEW.thread_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE threads
        SET
            message_count = GREATEST(0, message_count - 1),
            updated_at = NOW()
        WHERE id = OLD.thread_id;

        -- Update last_message_at to the most recent remaining message
        UPDATE threads t
        SET last_message_at = (
            SELECT MAX(created_at)
            FROM thread_messages
            WHERE thread_id = OLD.thread_id AND is_deleted = FALSE
        )
        WHERE id = OLD.thread_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign message position
CREATE OR REPLACE FUNCTION assign_message_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM thread_messages
        WHERE thread_id = NEW.thread_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_thread_message_count_trigger
    AFTER INSERT OR DELETE ON public.thread_messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_message_count();

CREATE TRIGGER assign_message_position_trigger
    BEFORE INSERT ON public.thread_messages
    FOR EACH ROW EXECUTE FUNCTION assign_message_position();

-- Update triggers for timestamp management
CREATE TRIGGER update_thread_folders_updated_at
    BEFORE UPDATE ON public.thread_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON public.threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_thread_messages_updated_at
    BEFORE UPDATE ON public.thread_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.thread_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_folder_assignments ENABLE ROW LEVEL SECURITY;

-- Thread folders RLS policies
CREATE POLICY "Users can view own thread folders" ON public.thread_folders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own thread folders" ON public.thread_folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thread folders" ON public.thread_folders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own thread folders" ON public.thread_folders
    FOR DELETE USING (auth.uid() = user_id AND is_default = FALSE);

-- Threads RLS policies
CREATE POLICY "Users can view own threads" ON public.threads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own threads" ON public.threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads" ON public.threads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads" ON public.threads
    FOR DELETE USING (auth.uid() = user_id);

-- Thread messages RLS policies
CREATE POLICY "Users can view messages in own threads" ON public.thread_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE id = thread_messages.thread_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own threads" ON public.thread_messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE id = thread_messages.thread_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own messages" ON public.thread_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can soft delete own messages" ON public.thread_messages
    FOR UPDATE USING (auth.uid() = user_id);

-- Thread folder assignments RLS policies
CREATE POLICY "Users can view own folder assignments" ON public.thread_folder_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE id = thread_folder_assignments.thread_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create folder assignments for own threads" ON public.thread_folder_assignments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE id = thread_folder_assignments.thread_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own folder assignments" ON public.thread_folder_assignments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE id = thread_folder_assignments.thread_id
            AND user_id = auth.uid()
        )
    );

-- =============================================================================
-- DATA MIGRATION FROM EXISTING CONVERSATIONS
-- =============================================================================

-- Create default folders for each user
INSERT INTO public.thread_folders (user_id, name, description, icon, is_default, sort_order)
SELECT DISTINCT
    p.id,
    'Professional Writing',
    'Business and professional content',
    'fas fa-briefcase',
    TRUE,
    1
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.thread_folders
    WHERE user_id = p.id AND name = 'Professional Writing'
);

INSERT INTO public.thread_folders (user_id, name, description, icon, is_default, sort_order)
SELECT DISTINCT
    p.id,
    'Creative Content',
    'Creative and artistic writing',
    'fas fa-palette',
    TRUE,
    2
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.thread_folders
    WHERE user_id = p.id AND name = 'Creative Content'
);

INSERT INTO public.thread_folders (user_id, name, description, icon, is_default, sort_order)
SELECT DISTINCT
    p.id,
    'Technical Documentation',
    'Technical and documentation content',
    'fas fa-code',
    TRUE,
    3
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.thread_folders
    WHERE user_id = p.id AND name = 'Technical Documentation'
);

INSERT INTO public.thread_folders (user_id, name, description, icon, is_default, sort_order)
SELECT DISTINCT
    p.id,
    'Social Media',
    'Social media posts and content',
    'fas fa-hashtag',
    TRUE,
    4
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.thread_folders
    WHERE user_id = p.id AND name = 'Social Media'
);

-- Migrate existing conversations to threads
DO $$
DECLARE
    conv RECORD;
    new_thread_id UUID;
    msg_position INTEGER;
BEGIN
    FOR conv IN
        SELECT * FROM public.conversations
        WHERE thread_id IS NULL AND is_migrated = FALSE
        ORDER BY created_at
    LOOP
        -- Create a new thread for each conversation
        INSERT INTO public.threads (
            id,
            user_id,
            name,
            category,
            created_at,
            updated_at,
            last_message_at
        ) VALUES (
            uuid_generate_v4(),
            conv.user_id,
            COALESCE(conv.title, 'Conversation from ' || to_char(conv.created_at, 'Mon DD, YYYY')),
            conv.category,
            conv.created_at,
            conv.updated_at,
            conv.last_activity_at
        ) RETURNING id INTO new_thread_id;

        -- Update the conversation with thread reference
        UPDATE public.conversations
        SET thread_id = new_thread_id, is_migrated = TRUE
        WHERE id = conv.id;

        -- Migrate user inputs as thread messages
        msg_position := 1;
        FOR msg IN
            SELECT * FROM public.user_inputs
            WHERE conversation_id = conv.id
            ORDER BY created_at
        LOOP
            -- Create user message
            INSERT INTO public.thread_messages (
                thread_id,
                user_id,
                role,
                content,
                position,
                created_at
            ) VALUES (
                new_thread_id,
                msg.user_id,
                'user',
                msg.raw_text,
                msg_position,
                msg.created_at
            );

            msg_position := msg_position + 1;

            -- Update user_input with thread reference
            UPDATE public.user_inputs
            SET thread_id = new_thread_id, message_position = msg_position - 1
            WHERE id = msg.id;
        END LOOP;

        -- Migrate draft responses as assistant messages
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'generated_drafts') THEN
            FOR msg IN
                SELECT * FROM public.generated_drafts
                WHERE conversation_id = conv.id AND is_accepted = TRUE
                ORDER BY created_at
            LOOP
                INSERT INTO public.thread_messages (
                    thread_id,
                    user_id,
                    role,
                    content,
                    position,
                    created_at,
                    metadata
                ) VALUES (
                    new_thread_id,
                    msg.user_id,
                    'assistant',
                    msg.content,
                    msg_position,
                    msg.created_at,
                    jsonb_build_object(
                        'cpl_score', msg.cpl_score,
                        'draft_type', msg.draft_type,
                        'model_used', msg.ai_model_used
                    )
                );

                msg_position := msg_position + 1;

                -- Update draft with thread reference
                UPDATE public.generated_drafts
                SET thread_id = new_thread_id
                WHERE id = msg.id;
            END LOOP;
        END IF;

        -- Update thread message count
        UPDATE public.threads
        SET message_count = msg_position - 1
        WHERE id = new_thread_id;
    END LOOP;
END $$;

-- =============================================================================
-- VIEWS FOR THREAD SYSTEM
-- =============================================================================

-- View for active threads with latest message
CREATE OR REPLACE VIEW thread_overview AS
SELECT
    t.id,
    t.user_id,
    t.name,
    t.category,
    t.is_active,
    t.is_archived,
    t.is_pinned,
    t.message_count,
    t.last_message_at,
    t.created_at,
    tf.name as folder_name,
    tf.icon as folder_icon,
    (
        SELECT content
        FROM thread_messages
        WHERE thread_id = t.id
        ORDER BY position DESC
        LIMIT 1
    ) as last_message,
    (
        SELECT role
        FROM thread_messages
        WHERE thread_id = t.id
        ORDER BY position DESC
        LIMIT 1
    ) as last_message_role
FROM threads t
LEFT JOIN thread_folders tf ON t.folder_id = tf.id
WHERE t.is_archived = FALSE;

-- View for thread statistics
CREATE OR REPLACE VIEW thread_stats AS
SELECT
    user_id,
    COUNT(*) as total_threads,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_threads,
    COUNT(*) FILTER (WHERE is_archived = TRUE) as archived_threads,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as threads_this_week,
    AVG(message_count) as avg_messages_per_thread,
    MAX(last_message_at) as last_activity
FROM threads
GROUP BY user_id;

-- =============================================================================
-- CLEANUP AND OPTIMIZATION
-- =============================================================================

-- Function to archive old inactive threads
CREATE OR REPLACE FUNCTION archive_inactive_threads()
RETURNS void AS $$
BEGIN
    UPDATE public.threads
    SET
        is_archived = TRUE,
        archived_at = NOW(),
        is_active = FALSE
    WHERE
        is_archived = FALSE
        AND last_message_at < NOW() - INTERVAL '90 days'
        AND is_pinned = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned messages
CREATE OR REPLACE FUNCTION cleanup_orphaned_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM public.thread_messages
    WHERE thread_id NOT IN (SELECT id FROM public.threads);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant necessary permissions
GRANT ALL ON public.thread_folders TO authenticated;
GRANT ALL ON public.threads TO authenticated;
GRANT ALL ON public.thread_messages TO authenticated;
GRANT ALL ON public.thread_folder_assignments TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================================================
-- VALIDATION AND ROLLBACK SUPPORT
-- =============================================================================

-- Add migration tracking
INSERT INTO schema_migrations (version, description, checksum)
VALUES (
    '002_thread_system',
    'Thread-based conversation system with folders and message management',
    md5('ascendia_thread_system_v2.0_2025-01-17')
) ON CONFLICT (version) DO NOTHING;

-- Validation queries (uncomment to test)
/*
-- Check thread creation
SELECT COUNT(*) as thread_count FROM public.threads;

-- Check message migration
SELECT COUNT(*) as message_count FROM public.thread_messages;

-- Check folder creation
SELECT COUNT(*) as folder_count FROM public.thread_folders;

-- Verify RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('threads', 'thread_messages', 'thread_folders');
*/

-- =============================================================================
-- ROLLBACK SCRIPT (Save separately if needed)
-- =============================================================================

/*
-- To rollback this migration, run:

-- Drop new views
DROP VIEW IF EXISTS thread_overview CASCADE;
DROP VIEW IF EXISTS thread_stats CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS update_thread_message_count_trigger ON public.thread_messages;
DROP TRIGGER IF EXISTS assign_message_position_trigger ON public.thread_messages;
DROP TRIGGER IF EXISTS update_thread_folders_updated_at ON public.thread_folders;
DROP TRIGGER IF EXISTS update_threads_updated_at ON public.threads;
DROP TRIGGER IF EXISTS update_thread_messages_updated_at ON public.thread_messages;

-- Drop functions
DROP FUNCTION IF EXISTS update_thread_message_count() CASCADE;
DROP FUNCTION IF EXISTS assign_message_position() CASCADE;
DROP FUNCTION IF EXISTS archive_inactive_threads() CASCADE;
DROP FUNCTION IF EXISTS cleanup_orphaned_messages() CASCADE;

-- Remove columns from existing tables
ALTER TABLE public.conversations DROP COLUMN IF EXISTS thread_id;
ALTER TABLE public.conversations DROP COLUMN IF EXISTS is_migrated;
ALTER TABLE public.user_inputs DROP COLUMN IF EXISTS thread_id;
ALTER TABLE public.user_inputs DROP COLUMN IF EXISTS thread_message_id;
ALTER TABLE public.user_inputs DROP COLUMN IF EXISTS message_position;

-- Drop new tables
DROP TABLE IF EXISTS public.thread_folder_assignments CASCADE;
DROP TABLE IF EXISTS public.thread_messages CASCADE;
DROP TABLE IF EXISTS public.threads CASCADE;
DROP TABLE IF EXISTS public.thread_folders CASCADE;

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '002_thread_system';
*/

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================