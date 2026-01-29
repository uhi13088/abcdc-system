-- ============================================
-- System Events Table for Event-Based Architecture
-- 이벤트 기반 아키텍처를 위한 시스템 이벤트 테이블
-- ============================================

-- Create system_events table for audit trail
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_processed ON system_events(processed) WHERE processed = FALSE;

-- Create notification category enum extension if not exists
DO $$
BEGIN
    -- Add new categories to notifications if column allows
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS category VARCHAR(50);
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Partition for performance (optional, for high-volume systems)
-- Events older than 90 days can be archived

-- Function to clean old events
CREATE OR REPLACE FUNCTION cleanup_old_system_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM system_events
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND processed = TRUE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT ON system_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON system_events TO service_role;

-- RLS Policy
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write events
CREATE POLICY "Service role full access to system_events"
    ON system_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment
COMMENT ON TABLE system_events IS 'Event log for event-based architecture audit trail';
COMMENT ON COLUMN system_events.event_type IS 'Event type (e.g., subscription.created, payment.failed)';
COMMENT ON COLUMN system_events.payload IS 'Full event payload as JSON';
COMMENT ON COLUMN system_events.processed IS 'Whether event has been processed by all handlers';

-- Done
SELECT 'System events table created!' as result;
