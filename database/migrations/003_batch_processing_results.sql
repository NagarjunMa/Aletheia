-- Migration for batch processing results table
-- Enables OpenAI Batch API integration for 50% cost reduction

CREATE TABLE IF NOT EXISTS batch_processing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  request_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Processing results
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  error text,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Performance metrics
  processing_time_ms integer NOT NULL DEFAULT 0,
  token_usage integer NOT NULL DEFAULT 0,

  -- Cost tracking
  cost_savings_percent decimal(5,2) DEFAULT 50.0, -- Batch API provides 50% savings
  estimated_cost_usd decimal(10,6),

  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,

  -- Indexes for performance
  UNIQUE(request_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_batch_processing_results_batch_id ON batch_processing_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_processing_results_user_id ON batch_processing_results(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_processing_results_status ON batch_processing_results(status);
CREATE INDEX IF NOT EXISTS idx_batch_processing_results_created_at ON batch_processing_results(created_at);

-- RLS policies for security
ALTER TABLE batch_processing_results ENABLE ROW LEVEL SECURITY;

-- Users can only access their own batch results
CREATE POLICY "batch_results_user_access" ON batch_processing_results
  FOR ALL USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Function to get batch processing statistics
CREATE OR REPLACE FUNCTION get_batch_processing_stats(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_processed bigint,
  total_cost_saved_usd numeric,
  average_processing_time_ms numeric,
  success_rate_percent numeric,
  total_tokens_processed bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_processed,
    COALESCE(SUM(estimated_cost_usd * cost_savings_percent / 100), 0) as total_cost_saved_usd,
    COALESCE(AVG(processing_time_ms), 0) as average_processing_time_ms,
    COALESCE(
      (COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0)) * 100,
      0
    ) as success_rate_percent,
    COALESCE(SUM(token_usage), 0) as total_tokens_processed
  FROM batch_processing_results
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
  AND status IN ('completed', 'failed');
END;
$$;

-- Function to clean up old batch results (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_batch_results()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM batch_processing_results
  WHERE created_at < now() - interval '30 days'
  AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Schedule automatic cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-batch-results', '0 2 * * 0', 'SELECT cleanup_old_batch_results();');

COMMENT ON TABLE batch_processing_results IS 'Stores results from OpenAI Batch API processing for 50% cost reduction';
COMMENT ON COLUMN batch_processing_results.batch_id IS 'OpenAI batch ID or internal batch identifier';
COMMENT ON COLUMN batch_processing_results.cost_savings_percent IS 'Percentage of cost saved using batch processing vs individual requests';
COMMENT ON FUNCTION get_batch_processing_stats IS 'Returns comprehensive statistics for batch processing performance and cost savings';