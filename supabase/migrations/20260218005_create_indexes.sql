-- Performance indexes

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_last_activity ON conversations(user_id, last_activity_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_threads_user_id ON threads(user_id);
CREATE INDEX idx_thread_messages_thread_id ON thread_messages(thread_id);
CREATE INDEX idx_user_inputs_conversation_id ON user_inputs(conversation_id);
CREATE INDEX idx_generated_drafts_user_input_id ON generated_drafts(user_input_id);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
