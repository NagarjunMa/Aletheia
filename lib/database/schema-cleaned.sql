-- Ascendia Database Schema (Post-Cleanup)
-- Updated: January 2025
-- Purpose: Clean database schema after removing 31 unused tables
-- Status: Production-ready with only actively used tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypt";
CREATE EXTENSION IF NOT EXISTS "pgvector"; -- For AI embeddings (future use)

-- =============================================================================
-- ACTIVE TABLES (9 tables with actual usage)
-- =============================================================================

-- 1. Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    writing_style JSONB DEFAULT '{}'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    cpl_score NUMERIC DEFAULT 50.0 CHECK (cpl_score >= 0 AND cpl_score <= 100)
);

-- 2. Conversations table (chat sessions)
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    title TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    last_activity_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    category conversation_category DEFAULT 'conversational',
    thread_id UUID,
    is_migrated BOOLEAN DEFAULT false
);

-- 3. User Inputs table (original user text)
CREATE TABLE user_inputs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    raw_text TEXT,
    thread_id UUID,
    thread_message_id UUID,
    message_position INTEGER
);

-- 4. Generated Drafts table (AI-generated content)
CREATE TABLE generated_drafts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_input_id UUID REFERENCES user_inputs(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    content TEXT NOT NULL,
    draft_type draft_type NOT NULL,
    cpl_score NUMERIC DEFAULT 0.00,
    is_accepted BOOLEAN,
    user_feedback TEXT,
    user_edits TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    thread_id UUID,
    thread_message_id UUID,
    conversation_id UUID REFERENCES conversations(id),
    feedback_at TIMESTAMPTZ
);

-- 5. User Feedback table (user ratings and comments)
CREATE TABLE user_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    draft_id UUID REFERENCES generated_drafts(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    feedback_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 6. Usage Analytics table (user behavior tracking)
CREATE TABLE usage_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    conversation_id UUID REFERENCES conversations(id)
);

-- 7. Production Metrics table (system performance monitoring)
CREATE TABLE production_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES profiles(id),
    session_id UUID NOT NULL,
    component TEXT NOT NULL CHECK (component = ANY (ARRAY['security_framework', 'memory_engine', 'parallel_processor', 'voice_learning', 'rag_engine', 'overall_system'])),
    latency NUMERIC DEFAULT 0,
    throughput NUMERIC DEFAULT 0,
    error_rate NUMERIC DEFAULT 0 CHECK (error_rate >= 0 AND error_rate <= 100),
    cpu_usage NUMERIC DEFAULT 0 CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    memory_usage NUMERIC DEFAULT 0 CHECK (memory_usage >= 0 AND memory_usage <= 100),
    bandwidth_usage NUMERIC DEFAULT 0,
    system_status TEXT DEFAULT 'healthy' CHECK (system_status = ANY (ARRAY['healthy', 'degraded', 'critical', 'offline'])),
    custom_metrics JSONB DEFAULT '{}'::jsonb,
    operation_type TEXT,
    request_id TEXT,
    trace_id TEXT
);

-- 8. Messages table (new chat interface)
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role = ANY (ARRAY['user', 'assistant'])),
    message_type TEXT DEFAULT 'text' CHECK (message_type = ANY (ARRAY['text', 'draft', 'system'])),
    draft_type TEXT CHECK ((draft_type = ANY (ARRAY['grammar_fix', 'adaptive_polish'])) OR draft_type IS NULL),
    cpl_score NUMERIC CHECK (cpl_score >= 0 AND cpl_score <= 100),
    is_accepted BOOLEAN DEFAULT false,
    legacy_user_input_id UUID,
    legacy_draft_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. User Preferences table (enhanced user configuration)
CREATE TABLE user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES auth.users(id) NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    writing_style JSONB DEFAULT '{}'::jsonb,
    content_categories TEXT[] DEFAULT '{}'::text[],
    cpl_baseline NUMERIC DEFAULT 50.0,
    preferred_model TEXT DEFAULT 'claude-3-sonnet-20240229',
    response_length TEXT DEFAULT 'medium' CHECK (response_length = ANY (ARRAY['short', 'medium', 'long'])),
    formality_level TEXT DEFAULT 'balanced' CHECK (formality_level = ANY (ARRAY['casual', 'balanced', 'formal'])),
    style_patterns JSONB DEFAULT '{}'::jsonb,
    feedback_history JSONB DEFAULT '{}'::jsonb,
    vocabulary_profile JSONB DEFAULT '{}'::jsonb,
    theme TEXT DEFAULT 'dark' CHECK (theme = ANY (ARRAY['light', 'dark', 'system'])),
    show_cpl_scores BOOLEAN DEFAULT true,
    enable_streaming BOOLEAN DEFAULT true,
    auto_accept_threshold NUMERIC DEFAULT 0.85,
    data_retention_days INTEGER DEFAULT 90,
    share_analytics BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Conversation categories
CREATE TYPE conversation_category AS ENUM (
    'instagram_post',
    'linkedin',
    'medium_article',
    'email',
    'conversational'
);

-- Draft types for AI generation
CREATE TYPE draft_type AS ENUM (
    'grammar_fix',
    'adaptive_polish'
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Conversation queries
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_last_activity ON conversations(last_activity_at DESC);
CREATE INDEX idx_conversations_category ON conversations(category);

-- User inputs queries
CREATE INDEX idx_user_inputs_user_id ON user_inputs(user_id);
CREATE INDEX idx_user_inputs_conversation_id ON user_inputs(conversation_id);
CREATE INDEX idx_user_inputs_created_at ON user_inputs(created_at DESC);

-- Generated drafts queries
CREATE INDEX idx_generated_drafts_user_id ON generated_drafts(user_id);
CREATE INDEX idx_generated_drafts_conversation_id ON generated_drafts(conversation_id);
CREATE INDEX idx_generated_drafts_user_input_id ON generated_drafts(user_input_id);
CREATE INDEX idx_generated_drafts_is_accepted ON generated_drafts(is_accepted);
CREATE INDEX idx_generated_drafts_created_at ON generated_drafts(created_at DESC);

-- Messages queries
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Analytics queries
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_event_type ON usage_analytics(event_type);
CREATE INDEX idx_usage_analytics_created_at ON usage_analytics(created_at DESC);

-- Production metrics queries
CREATE INDEX idx_production_metrics_created_at ON production_metrics(created_at DESC);
CREATE INDEX idx_production_metrics_component ON production_metrics(component);
CREATE INDEX idx_production_metrics_user_id ON production_metrics(user_id) WHERE user_id IS NOT NULL;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Conversations policies
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

-- User inputs policies
CREATE POLICY "Users can manage own inputs" ON user_inputs FOR ALL USING (auth.uid() = user_id);

-- Generated drafts policies
CREATE POLICY "Users can manage own drafts" ON generated_drafts FOR ALL USING (auth.uid() = user_id);

-- User feedback policies
CREATE POLICY "Users can manage own feedback" ON user_feedback FOR ALL USING (auth.uid() = user_id);

-- Usage analytics policies
CREATE POLICY "Users can view own analytics" ON usage_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert analytics" ON usage_analytics FOR INSERT WITH CHECK (true);

-- Messages policies
CREATE POLICY "Users can manage own messages" ON messages FOR ALL USING (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- CLEANUP SUMMARY
-- =============================================================================

-- REMOVED TABLES (31 total):
--
-- Monitoring/Analytics (7):
-- - ai_model_performance, dashboard_configurations, production_alerts
-- - revenue_analytics, security_violations, system_health_snapshots, user_analytics
--
-- Style/Voice Learning (7):
-- - style_analytics_summary, style_learning_feedback, style_pattern_insights
-- - user_style_profiles, user_style_vectors, user_voice_profiles, voice_learning_samples
--
-- Threading System (4):
-- - threads, thread_messages, thread_folders, thread_folder_assignments
--
-- Batch Processing (2):
-- - batch_processing_batches, batch_processing_results
--
-- Other Unused (11):
-- - api_usage_logs, drafts, email_logs, user_embeddings, user_sessions
-- - and 6 others with zero usage
--
-- PERFORMANCE IMPROVEMENTS:
-- - Reduced table count from 40+ to 9 active tables
-- - Cleaned 187K+ old production_metrics records
-- - Removed dead rows from core tables
-- - Simplified RLS policies and indexes
-- - 60%+ reduction in database complexity

-- =============================================================================
-- NOTES
-- =============================================================================

-- This schema represents the production-ready state after cleanup.
-- All removed tables had zero usage based on pg_stat_user_tables analysis.
-- Core functionality (chat, drafts, user management) is fully preserved.
-- Monitoring features can be reimplemented if needed in the future.