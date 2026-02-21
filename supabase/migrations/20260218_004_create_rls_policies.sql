-- Row Level Security policies: users can only access their own rows

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON messages FOR ALL USING (auth.uid() = user_id);

-- threads
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own threads" ON threads FOR ALL USING (auth.uid() = user_id);

-- thread_folders
ALTER TABLE thread_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own folders" ON thread_folders FOR ALL USING (auth.uid() = user_id);

-- thread_messages
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own thread messages" ON thread_messages FOR ALL USING (auth.uid() = user_id);

-- user_inputs
ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own inputs" ON user_inputs FOR ALL USING (auth.uid() = user_id);

-- generated_drafts
ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own drafts" ON generated_drafts FOR ALL USING (auth.uid() = user_id);

-- user_feedback
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own feedback" ON user_feedback FOR ALL USING (auth.uid() = user_id);

-- usage_analytics
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own analytics" ON usage_analytics FOR ALL USING (auth.uid() = user_id);

-- user_embeddings
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own embeddings" ON user_embeddings FOR ALL USING (auth.uid() = user_id);

-- api_usage_logs
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own logs" ON api_usage_logs FOR ALL USING (auth.uid() = user_id);

-- user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON user_sessions FOR ALL USING (auth.uid() = user_id);

-- Note: extension_rate_limits already has RLS enabled with no policies (service_role only) — intentional
