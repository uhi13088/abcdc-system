-- Migration: 033_backfill_scheduled_times_and_status
-- Description: 기존 출퇴근 기록에 예정 시간 및 상태 채우기
-- Created: 2026-01-21
--
-- 기존 attendance 기록 중 scheduled_check_in, scheduled_check_out이 NULL인 것들을
-- schedules 테이블에서 매칭하여 업데이트하고, 상태도 재계산합니다.

-- 1. schedules 테이블에서 예정 시간 매핑
-- attendance.staff_id + attendance.work_date로 schedules 조회하여 업데이트
UPDATE attendances a
SET
  scheduled_check_in = s.start_time,
  scheduled_check_out = s.end_time,
  extensions = COALESCE(a.extensions, '{}'::jsonb) || jsonb_build_object(
    'schedule_backfilled', true,
    'schedule_backfilled_at', NOW()::text,
    'migration', '033_backfill_scheduled_times_and_status'
  )
FROM schedules s
WHERE
  a.staff_id = s.staff_id
  AND a.work_date = s.work_date
  AND (a.scheduled_check_in IS NULL OR a.scheduled_check_out IS NULL);

-- 2. 지각 상태 재계산
-- 실제 출근시간이 예정 출근시간보다 늦은 경우 LATE
UPDATE attendances
SET
  status = 'LATE',
  extensions = COALESCE(extensions, '{}'::jsonb) || jsonb_build_object(
    'status_recalculated', true,
    'status_recalculated_at', NOW()::text,
    'previous_status', status,
    'late_minutes', EXTRACT(EPOCH FROM (actual_check_in - scheduled_check_in)) / 60
  )
WHERE
  scheduled_check_in IS NOT NULL
  AND actual_check_in IS NOT NULL
  AND actual_check_in > scheduled_check_in
  AND status = 'NORMAL';

-- 3. 조퇴 상태 재계산
-- 실제 퇴근시간이 예정 퇴근시간보다 30분 이상 빠른 경우 EARLY_LEAVE
-- 단, 이미 LATE인 경우는 LATE_AND_EARLY_LEAVE로 변경
UPDATE attendances
SET
  status = CASE
    WHEN status = 'LATE' THEN 'LATE_AND_EARLY_LEAVE'
    ELSE 'EARLY_LEAVE'
  END,
  extensions = COALESCE(extensions, '{}'::jsonb) || jsonb_build_object(
    'early_leave_recalculated', true,
    'early_leave_recalculated_at', NOW()::text,
    'previous_status', status,
    'early_minutes', EXTRACT(EPOCH FROM (scheduled_check_out - actual_check_out)) / 60
  )
WHERE
  scheduled_check_out IS NOT NULL
  AND actual_check_out IS NOT NULL
  AND actual_check_out < (scheduled_check_out - INTERVAL '30 minutes')
  AND status IN ('NORMAL', 'LATE');

-- 4. 조기출근 상태 재계산
-- 실제 출근시간이 예정 출근시간보다 30분 이상 빠른 경우 EARLY_CHECK_IN
-- 단, 기존 상태가 NORMAL인 경우만
UPDATE attendances
SET
  status = 'EARLY_CHECK_IN',
  extensions = COALESCE(extensions, '{}'::jsonb) || jsonb_build_object(
    'early_checkin_recalculated', true,
    'early_checkin_recalculated_at', NOW()::text,
    'previous_status', status,
    'early_checkin_minutes', EXTRACT(EPOCH FROM (scheduled_check_in - actual_check_in)) / 60
  )
WHERE
  scheduled_check_in IS NOT NULL
  AND actual_check_in IS NOT NULL
  AND actual_check_in < (scheduled_check_in - INTERVAL '30 minutes')
  AND status = 'NORMAL';

-- 5. 연장근무 상태 계산
-- 실제 근무시간이 8시간을 초과한 경우 (이미 다른 상태가 아닌 경우)
UPDATE attendances
SET
  status = 'OVERTIME',
  extensions = COALESCE(extensions, '{}'::jsonb) || jsonb_build_object(
    'overtime_recalculated', true,
    'overtime_recalculated_at', NOW()::text,
    'previous_status', status
  )
WHERE
  work_hours > 8
  AND status = 'NORMAL';

-- 6. 통계용 로그 (선택적 - 주석 해제하여 사용)
-- SELECT
--   'Total attendances updated with schedule' AS metric,
--   COUNT(*) AS count
-- FROM attendances
-- WHERE extensions->>'schedule_backfilled' = 'true';
--
-- SELECT
--   'Status recalculated' AS metric,
--   status,
--   COUNT(*) AS count
-- FROM attendances
-- WHERE extensions->>'status_recalculated' = 'true'
--    OR extensions->>'early_leave_recalculated' = 'true'
--    OR extensions->>'early_checkin_recalculated' = 'true'
--    OR extensions->>'overtime_recalculated' = 'true'
-- GROUP BY status;
