-- attendances 테이블에 UNSCHEDULED(미배정 출근) 상태 추가
-- 스케줄 없이 출근한 경우를 추적하기 위함

-- 기존 제약조건 삭제
ALTER TABLE attendances
DROP CONSTRAINT IF EXISTS attendances_status_check;

-- 새 제약조건 추가 (UNSCHEDULED 포함)
ALTER TABLE attendances
ADD CONSTRAINT attendances_status_check CHECK (
  status IN (
    'WORKING',
    'NORMAL',
    'LATE',
    'EARLY_CHECK_IN',
    'EARLY_LEAVE',
    'LATE_AND_EARLY_LEAVE',
    'OVERTIME',
    'ABSENT',
    'NO_SHOW',
    'VACATION',
    'UNSCHEDULED'
  )
);

COMMENT ON COLUMN attendances.status IS '출퇴근 상태: WORKING(근무중), NORMAL(정상), LATE(지각), EARLY_CHECK_IN(조기출근), EARLY_LEAVE(조퇴), LATE_AND_EARLY_LEAVE(지각+조퇴), OVERTIME(연장근무), ABSENT(결근), NO_SHOW(미출근), VACATION(휴가), UNSCHEDULED(미배정 출근)';

-- 미배정 출근 관련 컬럼 추가
ALTER TABLE attendances
ADD COLUMN IF NOT EXISTS unscheduled_reason TEXT,
ADD COLUMN IF NOT EXISTS unscheduled_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unscheduled_approved_by UUID REFERENCES users(id);

COMMENT ON COLUMN attendances.unscheduled_reason IS '미배정 출근 사유';
COMMENT ON COLUMN attendances.unscheduled_approved_at IS '미배정 출근 승인 시간';
COMMENT ON COLUMN attendances.unscheduled_approved_by IS '미배정 출근 승인자';

-- 기존 데이터 중 스케줄 없이 출근한 기록을 UNSCHEDULED로 업데이트
UPDATE attendances
SET status = 'UNSCHEDULED'
WHERE scheduled_check_in IS NULL
  AND scheduled_check_out IS NULL
  AND actual_check_in IS NOT NULL
  AND status = 'NORMAL';

-- approval_requests 테이블에 UNSCHEDULED_CHECKIN 타입 추가
ALTER TABLE approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_type_check;

ALTER TABLE approval_requests
ADD CONSTRAINT approval_requests_type_check CHECK (type IN (
  'LEAVE', 'OVERTIME', 'SCHEDULE_CHANGE', 'PURCHASE',
  'DISPOSAL', 'RESIGNATION', 'ABSENCE_EXCUSE', 'EXPENSE',
  'DOCUMENT', 'OTHER', 'UNSCHEDULED_CHECKIN'
));
