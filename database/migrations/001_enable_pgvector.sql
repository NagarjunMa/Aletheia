-- Enable pgvector extension for vector embeddings
-- Migration: 001_enable_pgvector.sql
-- Date: December 15, 2024
-- Purpose: Add vector embedding capabilities for cost-effective similarity search

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for storing user content embeddings
CREATE TABLE IF NOT EXISTS user_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content_hash text NOT NULL UNIQUE,
  content_snippet text NOT NULL, -- First 100 chars for reference
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content_type text NOT NULL CHECK (content_type IN ('user_input', 'generated_draft', 'user_feedback')),
  category text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table for user writing style vectors
CREATE TABLE IF NOT EXISTS user_style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  style_vector vector(1536), -- Aggregated style embedding
  complexity_preference vector(128), -- Complexity pattern vector
  formality_preference vector(128), -- Formality pattern vector
  vocabulary_preference vector(128), -- Vocabulary pattern vector
  sample_count integer DEFAULT 0, -- Number of samples used to build profile
  last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  confidence_score float DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS user_embeddings_user_id_idx ON user_embeddings(user_id);
CREATE INDEX IF NOT EXISTS user_embeddings_content_type_idx ON user_embeddings(content_type);
CREATE INDEX IF NOT EXISTS user_embeddings_category_idx ON user_embeddings(category);
CREATE INDEX IF NOT EXISTS user_embeddings_created_at_idx ON user_embeddings(created_at DESC);

-- Vector similarity search indexes using HNSW for performance
CREATE INDEX IF NOT EXISTS user_embeddings_embedding_idx ON user_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS user_style_profiles_style_vector_idx ON user_style_profiles
USING ivfflat (style_vector vector_cosine_ops) WITH (lists = 50);

-- Create RLS (Row Level Security) policies
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_style_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own embeddings
CREATE POLICY "Users can view their own embeddings" ON user_embeddings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own embeddings" ON user_embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own embeddings" ON user_embeddings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own embeddings" ON user_embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Users can only access their own style profiles
CREATE POLICY "Users can view their own style profile" ON user_style_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own style profile" ON user_style_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own style profile" ON user_style_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to find similar content for a user
CREATE OR REPLACE FUNCTION find_similar_content(
  query_embedding vector(1536),
  content_type_filter text DEFAULT NULL,
  user_id_filter uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content_snippet text,
  similarity float,
  content_type text,
  category text,
  created_at timestamp with time zone
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ue.id,
    ue.content_snippet,
    1 - (ue.embedding <=> query_embedding) AS similarity,
    ue.content_type,
    ue.category,
    ue.created_at
  FROM user_embeddings ue
  WHERE
    (user_id_filter IS NULL OR ue.user_id = user_id_filter) AND
    (content_type_filter IS NULL OR ue.content_type = content_type_filter) AND
    (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY ue.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to find similar writing styles
CREATE OR REPLACE FUNCTION find_similar_writing_styles(
  query_style_vector vector(1536),
  similarity_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  user_id uuid,
  similarity float,
  confidence_score float,
  sample_count integer
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    usp.user_id,
    1 - (usp.style_vector <=> query_style_vector) AS similarity,
    usp.confidence_score,
    usp.sample_count
  FROM user_style_profiles usp
  WHERE
    (1 - (usp.style_vector <=> query_style_vector)) > similarity_threshold AND
    usp.confidence_score > 0.3 -- Only include profiles with reasonable confidence
  ORDER BY usp.style_vector <=> query_style_vector
  LIMIT match_count;
$$;

-- Function to update user style profile (called after processing new content)
CREATE OR REPLACE FUNCTION update_user_style_profile(
  target_user_id uuid,
  new_style_embedding vector(1536),
  new_complexity_preference vector(128) DEFAULT NULL,
  new_formality_preference vector(128) DEFAULT NULL,
  new_vocabulary_preference vector(128) DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  existing_profile user_style_profiles%ROWTYPE;
  new_sample_count integer;
  blend_factor float;
BEGIN
  -- Get existing profile
  SELECT * INTO existing_profile
  FROM user_style_profiles
  WHERE user_id = target_user_id;

  IF existing_profile.id IS NULL THEN
    -- Create new profile
    INSERT INTO user_style_profiles (
      user_id,
      style_vector,
      complexity_preference,
      formality_preference,
      vocabulary_preference,
      sample_count,
      confidence_score
    ) VALUES (
      target_user_id,
      new_style_embedding,
      COALESCE(new_complexity_preference, array_fill(0, ARRAY[128])::vector),
      COALESCE(new_formality_preference, array_fill(0, ARRAY[128])::vector),
      COALESCE(new_vocabulary_preference, array_fill(0, ARRAY[128])::vector),
      1,
      0.1
    );
  ELSE
    -- Update existing profile with weighted average
    new_sample_count := existing_profile.sample_count + 1;
    blend_factor := 1.0 / new_sample_count; -- Give equal weight to all samples

    UPDATE user_style_profiles SET
      style_vector = (
        (existing_profile.style_vector * (1 - blend_factor)) +
        (new_style_embedding * blend_factor)
      )::vector(1536),
      complexity_preference = CASE
        WHEN new_complexity_preference IS NOT NULL THEN
          (
            (existing_profile.complexity_preference * (1 - blend_factor)) +
            (new_complexity_preference * blend_factor)
          )::vector(128)
        ELSE existing_profile.complexity_preference
      END,
      formality_preference = CASE
        WHEN new_formality_preference IS NOT NULL THEN
          (
            (existing_profile.formality_preference * (1 - blend_factor)) +
            (new_formality_preference * blend_factor)
          )::vector(128)
        ELSE existing_profile.formality_preference
      END,
      vocabulary_preference = CASE
        WHEN new_vocabulary_preference IS NOT NULL THEN
          (
            (existing_profile.vocabulary_preference * (1 - blend_factor)) +
            (new_vocabulary_preference * blend_factor)
          )::vector(128)
        ELSE existing_profile.vocabulary_preference
      END,
      sample_count = new_sample_count,
      confidence_score = LEAST(1.0, 0.1 + (new_sample_count * 0.05)), -- Increase confidence with more samples
      last_updated = NOW()
    WHERE user_id = target_user_id;
  END IF;
END;
$$;

-- Function to get user's writing style preferences
CREATE OR REPLACE FUNCTION get_user_style_preferences(target_user_id uuid)
RETURNS TABLE (
  has_profile boolean,
  style_vector vector(1536),
  complexity_preference vector(128),
  formality_preference vector(128),
  vocabulary_preference vector(128),
  confidence_score float,
  sample_count integer
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    (usp.id IS NOT NULL) as has_profile,
    usp.style_vector,
    usp.complexity_preference,
    usp.formality_preference,
    usp.vocabulary_preference,
    COALESCE(usp.confidence_score, 0.0),
    COALESCE(usp.sample_count, 0)
  FROM user_style_profiles usp
  WHERE usp.user_id = target_user_id;
$$;

-- Function to clean up old embeddings (for cost management)
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(
  retention_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete embeddings older than retention period
  DELETE FROM user_embeddings
  WHERE created_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_user_embeddings_updated_at ON user_embeddings;
CREATE TRIGGER update_user_embeddings_updated_at
  BEFORE UPDATE ON user_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE user_embeddings TO authenticated;
GRANT ALL ON TABLE user_style_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_content TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_writing_styles TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_style_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_style_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_embeddings TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_embeddings IS 'Stores vector embeddings for user content to enable semantic similarity search';
COMMENT ON TABLE user_style_profiles IS 'Stores learned user writing style preferences as vectors for personalization';
COMMENT ON FUNCTION find_similar_content IS 'Finds semantically similar content using vector similarity search';
COMMENT ON FUNCTION find_similar_writing_styles IS 'Finds users with similar writing styles';
COMMENT ON FUNCTION update_user_style_profile IS 'Updates user writing style profile with new content samples';
COMMENT ON FUNCTION get_user_style_preferences IS 'Retrieves user writing style preferences for content generation';
COMMENT ON FUNCTION cleanup_old_embeddings IS 'Cleans up old embeddings to manage storage costs';