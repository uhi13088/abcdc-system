-- Migration: 018_work_schedule_per_day
-- Description: Add per-day work schedule support
-- Created: 2026-01-12

-- Add work_schedule JSONB column to invitation_templates
-- Structure: {"0": {"startTime": "09:00", "endTime": "14:00", "breakMinutes": 30}, ...}
-- If null, fall back to work_start_time, work_end_time, break_minutes

ALTER TABLE invitation_templates
ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN invitation_templates.work_schedule IS
'Per-day work schedule settings. Format: {"dayIndex": {"startTime": "HH:mm", "endTime": "HH:mm", "breakMinutes": number}}. If null, uses work_start_time/work_end_time/break_minutes for all work_days.';

-- Also add to invitations table for per-invitation overrides
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT NULL;

COMMENT ON COLUMN invitations.work_schedule IS
'Per-day work schedule settings. Format: {"dayIndex": {"startTime": "HH:mm", "endTime": "HH:mm", "breakMinutes": number}}. If null, uses work_start_time/work_end_time/break_minutes for all work_days.';

-- Also add to users table for employee work schedules
ALTER TABLE users
ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT NULL;

COMMENT ON COLUMN users.work_schedule IS
'Per-day work schedule settings. Format: {"dayIndex": {"startTime": "HH:mm", "endTime": "HH:mm", "breakMinutes": number}}. If null, uses work_start_time/work_end_time/break_minutes for all work_days.';
