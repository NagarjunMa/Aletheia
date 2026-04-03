-- Migration: cleanup_dead_schema
-- Date: 2026-04-01
-- Purpose: Remove tables, functions, and enum values that belong to a
--          chatbot-era schema and are unused by the LinkedIn outreach extension.
--
-- SAFE TO RUN: All items below have been confirmed as unreferenced in
--              active application code (API routes, server actions, client code).
--
-- Tables kept: profiles, extension_rate_limits, user_preferences,
--              generated_drafts, user_feedback

-- ============================================================
-- 1. DROP UNUSED TABLES
-- ============================================================

-- Chatbot conversation threads — extension uses generated_drafts directly
DROP TABLE IF EXISTS usage_analytics CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_inputs CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Performance monitoring table — nothing in codebase writes to it
DROP TABLE IF EXISTS production_metrics CASCADE;

-- ============================================================
-- 2. DROP UNUSED FUNCTIONS
-- ============================================================

-- Vector similarity search — no embedding generation exists in the codebase;
-- these functions were never called from any API route or client code.
DROP FUNCTION IF EXISTS match_user_style_vectors(vector, float, int);
DROP FUNCTION IF EXISTS find_similar_style_vectors(uuid, int);
DROP FUNCTION IF EXISTS get_user_voice_stats(uuid);
DROP FUNCTION IF EXISTS aggregate_style_analytics();

-- Retention cleanup for dropped tables
DROP FUNCTION IF EXISTS cleanup_old_analytics();
DROP FUNCTION IF EXISTS cleanup_old_conversations();

-- ============================================================
-- 3. DROP UNUSED ENUM TYPE
-- ============================================================

-- conversation_category was only used by the conversations table (now dropped).
-- The values instagram_post, medium_article, conversational, linkedin, email
-- are not used by any remaining table. Drop the type entirely.
DROP TYPE IF EXISTS conversation_category CASCADE;

-- ============================================================
-- 4. NOTE ON draft_type ENUM
-- ============================================================
-- draft_type ('grammar_fix', 'adaptive_polish') is kept as-is.
-- 'adaptive_polish' is the active value used by the generate endpoint.
-- 'grammar_fix' is referenced as a valid check in sanitizer.ts.
-- Do NOT drop this type.
