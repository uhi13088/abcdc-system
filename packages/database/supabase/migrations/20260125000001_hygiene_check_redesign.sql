-- ============================================
-- HACCP 위생점검 테이블 개편
-- 01. 일반위생 공정관리 점검표 (일일점검) 구현
-- ============================================

-- ============================================
-- 1. 회사별 위생점검 항목 설정
-- ============================================
CREATE TABLE IF NOT EXISTS company_hygiene_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 비활성화된 점검 항목들 (해당 없는 항목)
  disabled_items JSONB DEFAULT '[]',

  -- 온도 측정 위치 설정
  temperature_locations JSONB DEFAULT '[
    {"key": "냉동창고", "enabled": true, "target_temp": -18},
    {"key": "배합실_냉장고", "enabled": true, "target_temp": 5},
    {"key": "내포장실_냉장고", "enabled": true, "target_temp": 5},
    {"key": "내포장실_냉동고", "enabled": true, "target_temp": -18}
  ]',

  -- IoT 장비 연동 설정
  iot_enabled BOOLEAN DEFAULT false,
  iot_device_ids JSONB DEFAULT '[]',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id)
);

-- ============================================
-- 2. 장비 온도 기록 (IoT 연동 대비)
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_temperature_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  record_date DATE NOT NULL,
  record_time TIME NOT NULL,

  -- 장비 정보
  equipment_location VARCHAR(100) NOT NULL, -- 냉동창고, 배합실_냉장고, 내포장실_냉장고, 내포장실_냉동고
  equipment_id VARCHAR(100), -- IoT 장비 ID (수동 입력 시 NULL)

  -- 온도 값
  temperature DECIMAL(5,2) NOT NULL,
  target_temperature DECIMAL(5,2), -- 기준 온도

  -- 입력 방식
  input_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (input_type IN ('manual', 'iot')),

  -- 검증
  is_within_limit BOOLEAN,
  deviation_action TEXT, -- 이탈 시 조치사항

  recorded_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 일일 위생점검 테이블 확장 (기존 테이블 개편)
-- ============================================

-- 기존 shift 컬럼의 체크 제약조건 삭제
ALTER TABLE daily_hygiene_checks
  DROP CONSTRAINT IF EXISTS daily_hygiene_checks_shift_check;

-- check_period 컬럼 추가 (작업전/작업중/작업후)
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS check_period VARCHAR(20);

-- check_period 체크 제약조건 추가
ALTER TABLE daily_hygiene_checks
  ADD CONSTRAINT daily_hygiene_checks_check_period_check
  CHECK (check_period IN ('작업전', '작업중', '작업후') OR check_period IS NULL);

-- 온도 기록 컬럼 추가
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS temperature_records JSONB DEFAULT '{}';

-- 작업전 점검 항목
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS pre_work_checks JSONB DEFAULT '{}';

-- 작업중 점검 항목
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS during_work_checks JSONB DEFAULT '{}';

-- 작업후 점검 항목
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS post_work_checks JSONB DEFAULT '{}';

-- 특이사항
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 개선조치 결과
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS improvement_result TEXT;

-- 점검자 이름 (외래키 없이)
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS checked_by_name VARCHAR(100);

-- 검증자 이름 (외래키 없이)
ALTER TABLE daily_hygiene_checks
  ADD COLUMN IF NOT EXISTS verified_by_name VARCHAR(100);

-- ============================================
-- 4. 온도 기록 연동 뷰 생성
-- ============================================
CREATE OR REPLACE VIEW hygiene_temperature_summary AS
SELECT
  etr.company_id,
  etr.record_date,
  etr.equipment_location,
  MIN(etr.record_time) as first_record_time,
  MAX(etr.record_time) as last_record_time,
  AVG(etr.temperature) as avg_temperature,
  MIN(etr.temperature) as min_temperature,
  MAX(etr.temperature) as max_temperature,
  COUNT(*) as record_count,
  SUM(CASE WHEN NOT etr.is_within_limit THEN 1 ELSE 0 END) as deviation_count
FROM equipment_temperature_records etr
GROUP BY etr.company_id, etr.record_date, etr.equipment_location;

-- ============================================
-- 5. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_equipment_temp_company_date
  ON equipment_temperature_records(company_id, record_date);
CREATE INDEX IF NOT EXISTS idx_equipment_temp_location
  ON equipment_temperature_records(company_id, equipment_location);
CREATE INDEX IF NOT EXISTS idx_hygiene_check_period
  ON daily_hygiene_checks(company_id, check_date, check_period);

-- ============================================
-- 6. RLS 정책 추가
-- ============================================
ALTER TABLE company_hygiene_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_temperature_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_hygiene_settings_policy ON company_hygiene_settings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY equipment_temperature_records_policy ON equipment_temperature_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 7. 기본 점검 항목 참조 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS hygiene_check_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_period VARCHAR(20) NOT NULL CHECK (check_period IN ('작업전', '작업중', '작업후')),
  item_key VARCHAR(100) NOT NULL,
  item_label VARCHAR(255) NOT NULL,
  item_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  requires_temperature BOOLEAN DEFAULT false,
  temperature_target DECIMAL(5,2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(check_period, item_key)
);

-- 기본 점검 항목 데이터 삽입
INSERT INTO hygiene_check_templates (check_period, item_key, item_label, item_order, is_required, requires_temperature, temperature_target) VALUES
-- 작업전 점검 항목
('작업전', 'work_clothes_clean', '작업복, 작업화 이상', 1, true, false, NULL),
('작업전', 'hand_wash_sanitize', '손세척 및 소독상태', 2, true, false, NULL),
('작업전', 'entrance_sanitize', '출입구 소독실 정상', 3, true, false, NULL),
('작업전', 'equipment_hygiene', '주변 설비 위생상태', 4, true, false, NULL),
('작업전', 'floor_drain_clean', '바닥 및 배수구 청소', 5, true, false, NULL),
('작업전', 'cross_contamination', '교차오염 방지', 6, true, false, NULL),
('작업전', 'ingredients_check', '사용재료 유통기한 확인', 7, true, false, NULL),
('작업전', 'freezer_temp', '냉동창고 온도', 8, true, true, -18),
('작업전', 'mixing_room_fridge_temp', '배합실 냉장고 온도', 9, true, true, 5),
('작업전', 'packaging_room_fridge_temp', '내포장실 냉장고/냉동고 온도', 10, true, true, 5),

-- 작업중 점검 항목
('작업중', 'thaw_water_temp', '해동수조 온도 확인', 1, true, true, 10),
('작업중', 'foreign_matter_sort', '이물선별 여부', 2, true, false, NULL),
('작업중', 'environment_temp_humidity', '환경온습도 확인', 3, true, false, NULL),

-- 작업후 점검 항목
('작업후', 'facility_equipment_clean', '시설 설비 청소상태 (물청소)', 1, true, false, NULL),
('작업후', 'cooking_tools_sanitize', '조리기구 세척 살균', 2, true, false, NULL),
('작업후', 'floor_drain_disinfect', '바닥 및 배수구 소독', 3, true, false, NULL),
('작업후', 'waste_disposal', '폐기물 처리 상태', 4, true, false, NULL),
('작업후', 'window_close', '창문 닫힘 상태', 5, true, false, NULL),
('작업후', 'freezer_temp_post', '냉동창고 온도', 6, true, true, -18),
('작업후', 'mixing_room_fridge_temp_post', '배합실 냉장고 온도', 7, true, true, 5),
('작업후', 'packaging_room_fridge_temp_post', '내포장실 냉장고/냉동고 온도', 8, true, true, 5)
ON CONFLICT (check_period, item_key) DO NOTHING;

-- Done
SELECT 'Hygiene check tables redesigned successfully!' as result;
