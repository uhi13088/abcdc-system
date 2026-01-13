-- 019_store_settings.sql
-- 매장별 세부 설정 추가

-- 급여 및 운영 관련 컬럼 추가
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pay_day INTEGER DEFAULT 10;  -- 매월 지급일 (1-31)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pay_period_type VARCHAR(20) DEFAULT 'previous_month';  -- 계산 기간 타입: previous_month(전월전체), current_month(당월전체), custom(사용자지정)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pay_period_start_day INTEGER;  -- 사용자 지정 시작일
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pay_period_end_day INTEGER;  -- 사용자 지정 종료일

-- 수당 적용 옵션
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allowance_overtime BOOLEAN DEFAULT false;  -- 연장근로수당 (시급 x 1.5배)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allowance_night BOOLEAN DEFAULT false;  -- 야간근로수당 (22:00~06:00, 시급 x 0.5배 추가)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allowance_holiday BOOLEAN DEFAULT false;  -- 휴일근로수당 (시급 x 1.5배)

-- 매장 운영시간
ALTER TABLE stores ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00';  -- 오픈 시간
ALTER TABLE stores ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '22:00';  -- 마감 시간

-- 코멘트 추가
COMMENT ON COLUMN stores.pay_day IS '매월 급여 지급일 (1-31)';
COMMENT ON COLUMN stores.pay_period_type IS '급여 계산 기간 타입: previous_month(전월전체), current_month(당월전체), custom(사용자지정)';
COMMENT ON COLUMN stores.allowance_overtime IS '연장근로수당 적용 여부 (시급 x 1.5배)';
COMMENT ON COLUMN stores.allowance_night IS '야간근로수당 적용 여부 (22:00~06:00, 시급 x 0.5배 추가)';
COMMENT ON COLUMN stores.allowance_holiday IS '휴일근로수당 적용 여부 (시급 x 1.5배)';
COMMENT ON COLUMN stores.opening_time IS '매장 오픈 시간';
COMMENT ON COLUMN stores.closing_time IS '매장 마감 시간';
