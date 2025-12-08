-- Ascendia Database Schema
-- Created: December 7, 2024
-- Purpose: Complete database schema for Personalized Voice Agent (PVA) with AI content generation

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypt";
CREATE EXTENSION IF NOT EXISTS "pgvector"; -- For AI embeddings (future use)

-- =============================================================================
-- CORE TABLES SCHEMA
-- =============================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    -- Core user data
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- AI and Personalization
    cpl_score DECIMAL(5,2) DEFAULT 50.0 CHECK (cpl_score >= 0 AND cpl_score <= 100),
    writing_style_data JSONB DEFAULT '{}',
    learning_preferences JSONB DEFAULT '{}',

    -- Usage and Subscription
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium', 'enterprise')),
    monthly_api_usage INTEGER DEFAULT 0 CHECK (monthly_api_usage >= 0),
    monthly_limit INTEGER DEFAULT 100 CHECK (monthly_limit > 0),

    -- User preferences
    preferences JSONB DEFAULT '{
        "theme": "system",
        "language": "en",
        "notifications": true,
        "auto_save": true,
        "default_category": "general"
    }',

    -- Privacy settings
    data_retention_days INTEGER DEFAULT 365 CHECK (data_retention_days > 0),
    analytics_enabled BOOLEAN DEFAULT true,

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Conversations table
CREATE TABLE conversations (
    -- Core conversation data
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Conversation metadata
    title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
    description TEXT CHECK (length(description) <= 1000),
    category TEXT DEFAULT 'general' CHECK (category IN ('email', 'letter', 'proposal', 'memo', 'general', 'creative', 'technical')),

    -- State management
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Context and metadata
    context JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- AI processing metadata
    total_drafts_generated INTEGER DEFAULT 0 CHECK (total_drafts_generated >= 0),
    average_cpl_score DECIMAL(5,2),

    -- Analytics
    total_time_spent_minutes INTEGER DEFAULT 0 CHECK (total_time_spent_minutes >= 0),
    word_count INTEGER DEFAULT 0 CHECK (word_count >= 0)
);

-- User inputs table (stores raw user text for learning)
CREATE TABLE user_inputs (
    -- Core input data
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Input content
    raw_text TEXT NOT NULL CHECK (length(raw_text) >= 1 AND length(raw_text) <= 10000),
    cleaned_text TEXT, -- Sanitized version

    -- Input metadata
    input_type TEXT DEFAULT 'text' CHECK (input_type IN ('text', 'voice', 'document', 'paste')),
    word_count INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN raw_text IS NULL THEN 0
            ELSE array_length(string_to_array(trim(raw_text), ' '), 1)
        END
    ) STORED,
    character_count INTEGER GENERATED ALWAYS AS (length(raw_text)) STORED,

    -- Processing metadata
    language_detected TEXT DEFAULT 'en',
    complexity_score DECIMAL(5,2),
    readability_score DECIMAL(5,2),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Content analysis (for learning)
    content_analysis JSONB DEFAULT '{}', -- Store linguistic analysis

    -- Privacy and retention
    sensitive_content_detected BOOLEAN DEFAULT FALSE,
    auto_delete_at TIMESTAMP WITH TIME ZONE
);

-- Generated drafts table
CREATE TABLE generated_drafts (
    -- Core draft data
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_input_id UUID REFERENCES user_inputs(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Draft content
    content TEXT NOT NULL CHECK (length(content) >= 1),
    original_content TEXT, -- Store original for comparison

    -- Draft classification
    draft_type TEXT NOT NULL CHECK (draft_type IN ('grammar_fix', 'adaptive_polish', 'creative_enhancement', 'tone_adjustment')),
    version INTEGER DEFAULT 1 CHECK (version > 0),

    -- AI processing data
    cpl_score DECIMAL(5,2) CHECK (cpl_score >= 0 AND cpl_score <= 100),
    target_cpl_score DECIMAL(5,2),
    processing_time_ms INTEGER CHECK (processing_time_ms >= 0),
    token_usage INTEGER CHECK (token_usage >= 0),

    -- User feedback
    is_accepted BOOLEAN, -- NULL = not reviewed, true/false = user decision
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    feedback_text TEXT,
    user_edits TEXT, -- Store user modifications

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- AI model metadata
    ai_model_used TEXT DEFAULT 'claude-3-sonnet-20240229',
    ai_model_version TEXT,
    processing_metadata JSONB DEFAULT '{}',

    -- Content metrics
    improvement_metrics JSONB DEFAULT '{}', -- Store before/after analysis
    quality_score DECIMAL(5,2),

    -- Content analysis
    word_count INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN content IS NULL THEN 0
            ELSE array_length(string_to_array(trim(content), ' '), 1)
        END
    ) STORED,
    character_count INTEGER GENERATED ALWAYS AS (length(content)) STORED
);

-- =============================================================================
-- SUPPORTING TABLES
-- =============================================================================

-- API usage logs table (for monitoring and billing)
CREATE TABLE api_usage_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- API call details
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,

    -- Usage metrics
    tokens_used INTEGER DEFAULT 0 CHECK (tokens_used >= 0),
    cost_cents INTEGER DEFAULT 0 CHECK (cost_cents >= 0),
    response_time_ms INTEGER CHECK (response_time_ms >= 0),

    -- Request metadata
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    user_agent TEXT,
    ip_address INET,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    error_details TEXT
);

-- User sessions table (for analytics and security)
CREATE TABLE user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Session details
    session_token TEXT UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    location_data JSONB,

    -- Session state
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Security
    security_flags JSONB DEFAULT '{}'
);

-- User feedback table (for system improvement)
CREATE TABLE user_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Feedback content
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug_report', 'feature_request', 'general', 'ai_quality')),
    title TEXT NOT NULL CHECK (length(title) <= 200),
    description TEXT NOT NULL CHECK (length(description) <= 2000),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    -- Context
    page_url TEXT,
    user_agent TEXT,
    screenshot_url TEXT,

    -- Status
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Admin response
    admin_notes TEXT,
    admin_user_id UUID
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_subscription ON profiles(subscription_status);
CREATE INDEX idx_profiles_cpl_score ON profiles(cpl_score);

-- Conversations indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_user_activity ON conversations(user_id, last_activity_at DESC);
CREATE INDEX idx_conversations_category ON conversations(category);
CREATE INDEX idx_conversations_archived ON conversations(is_archived, user_id);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);

-- User inputs indexes
CREATE INDEX idx_user_inputs_conversation ON user_inputs(conversation_id, created_at DESC);
CREATE INDEX idx_user_inputs_user_id ON user_inputs(user_id, created_at DESC);
CREATE INDEX idx_user_inputs_type ON user_inputs(input_type);
CREATE INDEX idx_user_inputs_word_count ON user_inputs(word_count);

-- Generated drafts indexes
CREATE INDEX idx_generated_drafts_user_input ON generated_drafts(user_input_id);
CREATE INDEX idx_generated_drafts_conversation ON generated_drafts(conversation_id, created_at DESC);
CREATE INDEX idx_generated_drafts_user ON generated_drafts(user_id, created_at DESC);
CREATE INDEX idx_generated_drafts_type ON generated_drafts(draft_type);
CREATE INDEX idx_generated_drafts_accepted ON generated_drafts(is_accepted) WHERE is_accepted IS NOT NULL;
CREATE INDEX idx_generated_drafts_cpl_score ON generated_drafts(cpl_score) WHERE cpl_score IS NOT NULL;
CREATE INDEX idx_generated_drafts_rating ON generated_drafts(user_rating) WHERE user_rating IS NOT NULL;

-- API usage logs indexes
CREATE INDEX idx_api_usage_user_date ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_usage_endpoint ON api_usage_logs(endpoint, created_at DESC);
CREATE INDEX idx_api_usage_cost ON api_usage_logs(cost_cents DESC);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- User feedback indexes
CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id, created_at DESC);
CREATE INDEX idx_user_feedback_status ON user_feedback(status, priority);
CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update user activity
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET last_activity_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update conversation activity
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_activity_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        total_drafts_generated = (
            SELECT COUNT(*)
            FROM generated_drafts
            WHERE conversation_id = NEW.conversation_id
        ),
        average_cpl_score = (
            SELECT AVG(cpl_score)
            FROM generated_drafts
            WHERE conversation_id = NEW.conversation_id
              AND cpl_score IS NOT NULL
        )
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update user CPL score based on accepted drafts
CREATE OR REPLACE FUNCTION update_user_cpl_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if user has accepted the draft
    IF NEW.is_accepted = TRUE THEN
        UPDATE profiles
        SET cpl_score = (
            SELECT AVG(cpl_score)
            FROM generated_drafts
            WHERE user_id = NEW.user_id
              AND is_accepted = TRUE
              AND cpl_score IS NOT NULL
              AND created_at >= NOW() - INTERVAL '30 days' -- Last 30 days
        )
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_drafts_updated_at
    BEFORE UPDATE ON generated_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_feedback_updated_at
    BEFORE UPDATE ON user_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply activity triggers
CREATE TRIGGER update_user_activity_on_input
    AFTER INSERT ON user_inputs
    FOR EACH ROW EXECUTE FUNCTION update_user_activity();

CREATE TRIGGER update_user_activity_on_draft
    AFTER INSERT ON generated_drafts
    FOR EACH ROW EXECUTE FUNCTION update_user_activity();

CREATE TRIGGER update_conversation_activity_on_input
    AFTER INSERT ON user_inputs
    FOR EACH ROW EXECUTE FUNCTION update_conversation_activity();

CREATE TRIGGER update_conversation_activity_on_draft
    AFTER INSERT ON generated_drafts
    FOR EACH ROW EXECUTE FUNCTION update_conversation_activity();

-- Apply stats triggers
CREATE TRIGGER update_conversation_stats_on_draft
    AFTER INSERT ON generated_drafts
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

CREATE TRIGGER update_user_cpl_on_acceptance
    AFTER UPDATE OF is_accepted ON generated_drafts
    FOR EACH ROW EXECUTE FUNCTION update_user_cpl_score();

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Conversations RLS policies
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- User inputs RLS policies
CREATE POLICY "Users can view own inputs" ON user_inputs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inputs" ON user_inputs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inputs" ON user_inputs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own inputs" ON user_inputs
    FOR DELETE USING (auth.uid() = user_id);

-- Generated drafts RLS policies
CREATE POLICY "Users can view own drafts" ON generated_drafts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts" ON generated_drafts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts" ON generated_drafts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts" ON generated_drafts
    FOR DELETE USING (auth.uid() = user_id);

-- API usage logs RLS policies
CREATE POLICY "Users can view own API usage" ON api_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert API usage" ON api_usage_logs
    FOR INSERT WITH CHECK (true); -- Allow system to log usage

-- User sessions RLS policies
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions" ON user_sessions
    FOR ALL USING (true); -- Allow system to manage sessions

-- User feedback RLS policies
CREATE POLICY "Users can view own feedback" ON user_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON user_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON user_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- INITIAL DATA AND CONSTRAINTS
-- =============================================================================

-- Add constraint to ensure at least one draft per user input
-- (This will be enforced at the application level)

-- Add constraint to prevent excessive API usage
ALTER TABLE api_usage_logs ADD CONSTRAINT reasonable_cost
    CHECK (cost_cents <= 10000); -- Max $100 per single API call

-- Add constraint for reasonable token usage
ALTER TABLE generated_drafts ADD CONSTRAINT reasonable_tokens
    CHECK (token_usage <= 100000); -- Max 100k tokens per draft

-- Add constraint for draft content length
ALTER TABLE generated_drafts ADD CONSTRAINT reasonable_content_length
    CHECK (length(content) <= 50000); -- Max 50k characters

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for user dashboard statistics
CREATE VIEW user_dashboard_stats AS
SELECT
    p.id as user_id,
    p.full_name,
    p.cpl_score,
    p.subscription_status,
    p.monthly_api_usage,
    p.monthly_limit,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= NOW() - INTERVAL '7 days') as conversations_this_week,
    COUNT(DISTINCT gd.id) as total_drafts,
    COUNT(DISTINCT gd.id) FILTER (WHERE gd.created_at >= NOW() - INTERVAL '7 days') as drafts_this_week,
    COUNT(DISTINCT gd.id) FILTER (WHERE gd.is_accepted = true) as accepted_drafts,
    ROUND(AVG(gd.cpl_score) FILTER (WHERE gd.cpl_score IS NOT NULL), 2) as avg_cpl_score,
    SUM(gd.token_usage) as total_tokens_used
FROM profiles p
LEFT JOIN conversations c ON p.id = c.user_id AND c.is_archived = false
LEFT JOIN generated_drafts gd ON p.id = gd.user_id
GROUP BY p.id, p.full_name, p.cpl_score, p.subscription_status, p.monthly_api_usage, p.monthly_limit;

-- View for conversation details with stats
CREATE VIEW conversation_details AS
SELECT
    c.*,
    COUNT(ui.id) as input_count,
    COUNT(gd.id) as draft_count,
    COUNT(gd.id) FILTER (WHERE gd.is_accepted = true) as accepted_drafts,
    COUNT(gd.id) FILTER (WHERE gd.is_accepted = false) as rejected_drafts,
    ROUND(AVG(gd.cpl_score) FILTER (WHERE gd.cpl_score IS NOT NULL), 2) as avg_cpl_score,
    SUM(gd.token_usage) as total_tokens,
    MAX(gd.created_at) as last_draft_at
FROM conversations c
LEFT JOIN user_inputs ui ON c.id = ui.conversation_id
LEFT JOIN generated_drafts gd ON c.id = gd.conversation_id
GROUP BY c.id;

-- =============================================================================
-- CLEANUP AND MAINTENANCE
-- =============================================================================

-- Function to cleanup old data based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old API usage logs (keep 1 year)
    DELETE FROM api_usage_logs
    WHERE created_at < NOW() - INTERVAL '365 days';

    -- Delete expired sessions
    DELETE FROM user_sessions
    WHERE expires_at < NOW();

    -- Auto-delete user inputs marked for deletion
    DELETE FROM user_inputs
    WHERE auto_delete_at IS NOT NULL
      AND auto_delete_at < NOW();

    -- Archive old conversations (based on user preference)
    UPDATE conversations
    SET is_archived = true
    WHERE last_activity_at < NOW() - INTERVAL '180 days'
      AND is_archived = false;

END;
$$ language 'plpgsql';

-- Schedule cleanup (this would be set up as a cron job or scheduled function)
-- Example: SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read access to anonymous users for public data (if needed)
-- GRANT SELECT ON specific_public_tables TO anon;

-- Grant service role access for system operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth with AI preferences';
COMMENT ON TABLE conversations IS 'User conversation threads with categorization and metadata';
COMMENT ON TABLE user_inputs IS 'Raw user input text for AI processing and learning';
COMMENT ON TABLE generated_drafts IS 'AI-generated content drafts with user feedback';
COMMENT ON TABLE api_usage_logs IS 'API usage tracking for billing and monitoring';
COMMENT ON TABLE user_sessions IS 'User session tracking for security and analytics';
COMMENT ON TABLE user_feedback IS 'User feedback for system improvement';

COMMENT ON COLUMN profiles.cpl_score IS 'Content Polish Level - user writing complexity preference (0-100)';
COMMENT ON COLUMN generated_drafts.draft_type IS 'Type of draft: grammar_fix, adaptive_polish, creative_enhancement, tone_adjustment';
COMMENT ON COLUMN generated_drafts.is_accepted IS 'NULL=not reviewed, TRUE=accepted, FALSE=rejected';

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================

-- Table to track schema versions for migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum TEXT
);

-- Insert initial schema version
INSERT INTO schema_migrations (version, description, checksum)
VALUES (
    '001_initial_schema',
    'Initial Ascendia database schema with core tables, RLS policies, and indexes',
    md5('ascendia_schema_v1.0_2024-12-07')
) ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================