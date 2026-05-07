-- Create enums (must run before tables that reference them)

CREATE TYPE conversation_category AS ENUM (
  'instagram_post', 'linkedin', 'medium_article', 'email', 'conversational'
);

CREATE TYPE draft_type AS ENUM (
  'grammar_fix', 'adaptive_polish'
);
