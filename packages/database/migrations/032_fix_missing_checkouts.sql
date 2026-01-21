-- Migration: 032_fix_missing_checkouts
-- Description: 기존 퇴근 미처리 기록 일괄 정리
-- Created: 2026-01-21
--
-- 퇴근 버튼을 누르지 않고 퇴근한 기록들을 자동으로 정리합니다.
-- - 예정 퇴근 시간이 있는 경우: 예정 퇴근 시간으로 처리
-- - 예정 퇴근 시간이 없는 경우: 출근 후 8시간으로 처리
-- - 상태를 WORKING에서 NORMAL로 변경

-- 1. 예정 퇴근 시간이 있는 미퇴근 기록 처리
UPDATE attendances
SET
  actual_check_out = scheduled_check_out,
  status = 'NORMAL',
  work_hours = EXTRACT(EPOCH FROM (scheduled_check_out - actual_check_in)) / 3600 - 1, -- 1시간 휴게시간 제외
  extensions = jsonb_build_object(
    'auto_checkout', true,
    'auto_checkout_reason', '예정 퇴근 시간 기준 일괄 처리 (마이그레이션)',
    'auto_checkout_at', NOW()::text,
    'migration', '032_fix_missing_checkouts'
  )
WHERE
  actual_check_in IS NOT NULL
  AND actual_check_out IS NULL
  AND scheduled_check_out IS NOT NULL
  AND work_date < CURRENT_DATE;

-- 2. 예정 퇴근 시간이 없는 미퇴근 기록 처리 (출근 후 8시간)
UPDATE attendances
SET
  actual_check_out = actual_check_in + INTERVAL '8 hours',
  status = 'NORMAL',
  work_hours = 7, -- 8시간 - 1시간 휴게시간
  extensions = jsonb_build_object(
    'auto_checkout', true,
    'auto_checkout_reason', '출근 후 8시간 기준 일괄 처리 (마이그레이션)',
    'auto_checkout_at', NOW()::text,
    'migration', '032_fix_missing_checkouts'
  )
WHERE
  actual_check_in IS NOT NULL
  AND actual_check_out IS NULL
  AND scheduled_check_out IS NULL
  AND work_date < CURRENT_DATE;

-- 3. WORKING 상태인데 퇴근 기록이 있는 경우 NORMAL로 변경
UPDATE attendances
SET status = 'NORMAL'
WHERE
  status = 'WORKING'
  AND actual_check_out IS NOT NULL;

-- 4. 오늘 이전 기록 중 아직 WORKING 상태인 것들도 정리
UPDATE attendances
SET status = 'NORMAL'
WHERE
  status = 'WORKING'
  AND work_date < CURRENT_DATE;

-- 작업 시간 음수 방지
UPDATE attendances
SET work_hours = 0
WHERE work_hours < 0;

-- 연장근로 시간 계산 (8시간 초과분)
UPDATE attendances
SET overtime_hours = GREATEST(0, work_hours - 8)
WHERE
  overtime_hours IS NULL OR overtime_hours = 0
  AND work_hours > 8;
