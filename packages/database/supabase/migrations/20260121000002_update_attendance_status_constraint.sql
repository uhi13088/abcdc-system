-- attendances 테이블의 status 제약조건 업데이트
-- 기존: NORMAL, LATE, EARLY_LEAVE, ABSENT, VACATION
-- 추가: WORKING, EARLY_CHECK_IN, LATE_AND_EARLY_LEAVE, OVERTIME, NO_SHOW

-- 기존 제약조건 삭제
ALTER TABLE attendances
DROP CONSTRAINT IF EXISTS attendances_status_check;

-- 새 제약조건 추가
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
    'VACATION'
  )
);

COMMENT ON COLUMN attendances.status IS '출퇴근 상태: WORKING(근무중), NORMAL(정상), LATE(지각), EARLY_CHECK_IN(조기출근), EARLY_LEAVE(조퇴), LATE_AND_EARLY_LEAVE(지각+조퇴), OVERTIME(연장근무), ABSENT(결근), NO_SHOW(미출근), VACATION(휴가)';
