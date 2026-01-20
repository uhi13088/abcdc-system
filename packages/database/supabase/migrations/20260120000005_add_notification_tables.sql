-- Migration: Add notification tables
-- These tables are needed for push notifications

-- User FCM tokens
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(20),
  device_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fcm_token)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  actions JSONB,
  deep_link TEXT,
  data JSONB,
  sound VARCHAR(50),
  vibration BOOLEAN DEFAULT true,
  badge INTEGER,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  categories JSONB DEFAULT '{}',
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  digest_enabled BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fcm_user ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_active ON user_fcm_tokens(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_category ON notifications(user_id, category);

-- Enable RLS
ALTER TABLE user_fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_fcm_tokens
CREATE POLICY user_fcm_tokens_select ON user_fcm_tokens FOR SELECT USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY user_fcm_tokens_insert ON user_fcm_tokens FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY user_fcm_tokens_update ON user_fcm_tokens FOR UPDATE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY user_fcm_tokens_delete ON user_fcm_tokens FOR DELETE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- RLS Policies for notifications
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  OR get_current_user_role() IN ('super_admin', 'company_admin')
);

CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- RLS Policies for notification_preferences
CREATE POLICY notification_preferences_all ON notification_preferences FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);
