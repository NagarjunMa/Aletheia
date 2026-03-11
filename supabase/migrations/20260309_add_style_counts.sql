-- Add approved/rejected message counters to user_preferences
-- Used by the voice learning feedback loop to track when enough
-- approvals have been collected to activate LEARNED_STYLE in prompts.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS approved_message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_message_count INTEGER DEFAULT 0;
