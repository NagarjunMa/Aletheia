-- Tier 1 tables: no inter-table dependencies

-- profiles (references auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  cpl_score NUMERIC,
  preferences JSONB DEFAULT '{"theme":"system","language":"en","notifications":true,"auto_save":true,"default_category":"general"}',
  writing_style JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_preferences (references auth.users)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  theme TEXT,
  timezone TEXT,
  preferred_model TEXT,
  response_length TEXT,
  formality_level TEXT,
  writing_style JSONB,
  style_patterns JSONB,
  vocabulary_profile JSONB,
  cpl_baseline NUMERIC,
  auto_accept_threshold NUMERIC,
  show_cpl_scores BOOLEAN,
  enable_streaming BOOLEAN,
  content_categories TEXT[],
  feedback_history JSONB,
  data_retention_days INTEGER,
  share_analytics BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- thread_folders (references profiles)
CREATE TABLE thread_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
