-- CCP 월간 검증점검표 기능 강화
-- 공정별 검증 질문 템플릿 및 체크리스트 응답 시스템

-- 1. CCP 공정 유형 테이블
CREATE TABLE IF NOT EXISTS ccp_process_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- 공정별 모니터링 파라미터 (JSONB)
    parameters JSONB DEFAULT '[]',
    -- 예: [{"key": "heating_temp", "label": "가열온도", "unit": "°C"}, ...]
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- 2. CCP 검증 질문 템플릿 테이블
CREATE TABLE IF NOT EXISTS ccp_verification_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    process_type_id UUID REFERENCES ccp_process_types(id) ON DELETE CASCADE,
    question_code VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(50) DEFAULT 'STANDARD',
    -- 카테고리: STANDARD(표준3문항), CALIBRATION(검교정), CUSTOM(사용자정의)
    help_text TEXT,
    -- 질문에 대한 도움말/가이드
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 공통 검증 질문 (장비 검교정 등)
CREATE TABLE IF NOT EXISTS ccp_common_verification_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    question_code VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(50) DEFAULT 'CALIBRATION',
    -- CALIBRATION, GENERAL, DOCUMENTATION 등
    equipment_type VARCHAR(50),
    -- 관련 장비 유형: THERMOMETER, SCALE, TIMER, METAL_DETECTOR 등
    calibration_frequency VARCHAR(50),
    -- 검교정 주기: YEARLY, QUARTERLY, MONTHLY 등
    help_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, question_code)
);

-- 4. CCP 검증 체크리스트 마스터 (월간 검증 헤더)
-- 기존 ccp_verifications 테이블에 컬럼 추가
ALTER TABLE ccp_verifications
ADD COLUMN IF NOT EXISTS special_notes TEXT,
ADD COLUMN IF NOT EXISTS action_taken TEXT,
ADD COLUMN IF NOT EXISTS equipment_calibration_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS overall_compliance_status VARCHAR(20) DEFAULT 'PENDING',
-- PENDING, COMPLIANT, NON_COMPLIANT, PARTIAL
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT',
-- DRAFT, SUBMITTED, APPROVED, REJECTED
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS process_type_id UUID REFERENCES ccp_process_types(id);

-- 5. CCP 검증 질문 응답 테이블 (체크리스트 응답)
CREATE TABLE IF NOT EXISTS ccp_verification_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    verification_id UUID NOT NULL REFERENCES ccp_verifications(id) ON DELETE CASCADE,
    question_id UUID,
    -- process question or common question
    common_question_id UUID,
    is_compliant BOOLEAN,
    -- true = 예(적합), false = 아니오(부적합), null = 미확인
    non_compliance_reason TEXT,
    corrective_action TEXT,
    evidence_notes TEXT,
    -- 확인 근거/증빙 메모
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    checked_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_question_or_common CHECK (
        (question_id IS NOT NULL AND common_question_id IS NULL) OR
        (question_id IS NULL AND common_question_id IS NOT NULL)
    )
);

-- 6. 장비 검교정 기록 테이블
CREATE TABLE IF NOT EXISTS equipment_calibration_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    equipment_type VARCHAR(50) NOT NULL,
    -- THERMOMETER, SCALE, TIMER, METAL_DETECTOR, WASH_TANK 등
    equipment_name VARCHAR(100) NOT NULL,
    equipment_code VARCHAR(50),
    -- 장비 고유번호
    location VARCHAR(100),
    last_calibration_date DATE,
    next_calibration_date DATE,
    calibration_frequency VARCHAR(50) DEFAULT 'YEARLY',
    calibration_provider VARCHAR(100),
    -- 검교정 업체
    certificate_number VARCHAR(100),
    calibration_result VARCHAR(20) DEFAULT 'PASS',
    -- PASS, FAIL, CONDITIONAL
    notes TEXT,
    certificate_file_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CCP definitions 테이블에 process_type 연결
ALTER TABLE ccp_definitions
ADD COLUMN IF NOT EXISTS process_type_id UUID REFERENCES ccp_process_types(id);

-- 8. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ccp_process_types_company ON ccp_process_types(company_id);
CREATE INDEX IF NOT EXISTS idx_ccp_verification_questions_process ON ccp_verification_questions(process_type_id);
CREATE INDEX IF NOT EXISTS idx_ccp_verification_responses_verification ON ccp_verification_responses(verification_id);
CREATE INDEX IF NOT EXISTS idx_equipment_calibration_company ON equipment_calibration_records(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_calibration_next_date ON equipment_calibration_records(next_calibration_date);

-- 9. RLS 정책
ALTER TABLE ccp_process_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccp_verification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccp_common_verification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccp_verification_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_calibration_records ENABLE ROW LEVEL SECURITY;

-- ccp_process_types RLS
CREATE POLICY "Users can view own company process types" ON ccp_process_types
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can manage own company process types" ON ccp_process_types
    FOR ALL USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

-- ccp_verification_questions RLS
CREATE POLICY "Users can view own company verification questions" ON ccp_verification_questions
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can manage own company verification questions" ON ccp_verification_questions
    FOR ALL USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

-- ccp_common_verification_questions RLS
CREATE POLICY "Users can view own company common questions" ON ccp_common_verification_questions
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can manage own company common questions" ON ccp_common_verification_questions
    FOR ALL USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

-- ccp_verification_responses RLS
CREATE POLICY "Users can view own company verification responses" ON ccp_verification_responses
    FOR SELECT USING (
        verification_id IN (
            SELECT id FROM ccp_verifications
            WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage own company verification responses" ON ccp_verification_responses
    FOR ALL USING (
        verification_id IN (
            SELECT id FROM ccp_verifications
            WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
        )
    );

-- equipment_calibration_records RLS
CREATE POLICY "Users can view own company calibration records" ON equipment_calibration_records
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can manage own company calibration records" ON equipment_calibration_records
    FOR ALL USING (
        company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    );

-- 10. 기본 공정 유형 템플릿 테이블 (신규 회사 초기화용)
CREATE TABLE IF NOT EXISTS ccp_process_type_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parameters JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 기본 검증 질문 템플릿 테이블
CREATE TABLE IF NOT EXISTS ccp_verification_question_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_type_code VARCHAR(50) NOT NULL,
    question_code VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(50) DEFAULT 'STANDARD',
    help_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 기본 공통 질문 템플릿
CREATE TABLE IF NOT EXISTS ccp_common_question_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_code VARCHAR(50) NOT NULL UNIQUE,
    question_text TEXT NOT NULL,
    question_category VARCHAR(50) DEFAULT 'CALIBRATION',
    equipment_type VARCHAR(50),
    calibration_frequency VARCHAR(50),
    help_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 기본 데이터 삽입 - 공정 유형
INSERT INTO ccp_process_type_templates (code, name, description, parameters, sort_order) VALUES
('HEATING_OVEN', '가열(오븐) 공정', '오븐을 이용한 가열 공정의 온도 및 시간 관리',
 '[{"key": "heating_temp", "label": "가열온도", "unit": "°C"}, {"key": "heating_time", "label": "가열시간", "unit": "분"}, {"key": "product_temp", "label": "가열 후 제품온도", "unit": "°C"}]', 1),
('CREAM_WHIPPING', '크림제조(휘핑) 공정', '크림 휘핑 공정의 배합량, 온도, 시간 관리',
 '[{"key": "mixing_amount", "label": "배합량", "unit": "kg"}, {"key": "product_temp", "label": "품온", "unit": "°C"}, {"key": "consumption_time", "label": "소진시간", "unit": "분"}, {"key": "room_temp", "label": "작업장온도", "unit": "°C"}]', 2),
('SYRUP_HEATING', '시럽가열 공정', '시럽 가열 공정의 온도 및 시간 관리',
 '[{"key": "heating_temp", "label": "가열온도", "unit": "°C"}, {"key": "heating_time", "label": "가열시간", "unit": "분"}, {"key": "product_temp", "label": "가열 후 제품온도", "unit": "°C"}]', 3),
('WASHING', '세척 공정', '원료 세척 공정의 수량, 시간, 교체주기 관리',
 '[{"key": "material_amount", "label": "원료량", "unit": "kg"}, {"key": "water_amount", "label": "세척수량", "unit": "L"}, {"key": "washing_time", "label": "세척시간", "unit": "분"}, {"key": "water_change_cycle", "label": "세척수 교체주기", "unit": "회"}]', 4),
('METAL_DETECTION', '금속검출 공정', '금속검출기를 이용한 이물 검출 공정 관리',
 '[{"key": "sensitivity_fe", "label": "Fe 감도", "unit": "mm"}, {"key": "sensitivity_sus", "label": "SUS 감도", "unit": "mm"}, {"key": "test_piece_check", "label": "테스트피스 확인", "unit": ""}]', 5),
('COOLING', '냉각 공정', '제품 냉각 공정의 온도 및 시간 관리',
 '[{"key": "cooling_temp", "label": "냉각온도", "unit": "°C"}, {"key": "cooling_time", "label": "냉각시간", "unit": "분"}, {"key": "target_temp", "label": "목표온도", "unit": "°C"}]', 6),
('PACKAGING', '포장 공정', '제품 포장 공정의 밀봉 및 표시 관리',
 '[{"key": "seal_temp", "label": "실링온도", "unit": "°C"}, {"key": "seal_pressure", "label": "실링압력", "unit": "kPa"}]', 7)
ON CONFLICT (code) DO NOTHING;

-- 14. 기본 데이터 삽입 - 공정별 검증 질문 (표준 3문항)
INSERT INTO ccp_verification_question_templates (process_type_code, question_code, question_text, question_category, help_text, sort_order) VALUES
-- 가열(오븐) 공정
('HEATING_OVEN', 'HEATING_OVEN_Q1', '종사자가 주기적으로 가열온도 및 가열시간, 가열 후 제품온도를 확인하고 그 내용을 기록하고 있습니까?', 'STANDARD', 'CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다.', 1),
('HEATING_OVEN', 'HEATING_OVEN_Q2', '종사자가 가열온도 및 가열시간, 가열 후 제품온도를 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('HEATING_OVEN', 'HEATING_OVEN_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3),

-- 크림제조(휘핑) 공정
('CREAM_WHIPPING', 'CREAM_WHIPPING_Q1', '종사자가 주기적으로 배합량, 품온, 소진시간, 작업장온도를 확인하고 그 내용을 기록하고 있습니까?', 'STANDARD', 'CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다.', 1),
('CREAM_WHIPPING', 'CREAM_WHIPPING_Q2', '종사자가 배합량, 품온, 소진시간, 작업장온도를 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('CREAM_WHIPPING', 'CREAM_WHIPPING_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3),

-- 시럽가열 공정
('SYRUP_HEATING', 'SYRUP_HEATING_Q1', '종사자가 주기적으로 가열온도 및 가열시간, 가열 후 제품온도를 확인하고 그 내용을 기록하고 있습니까?', 'STANDARD', 'CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다.', 1),
('SYRUP_HEATING', 'SYRUP_HEATING_Q2', '종사자가 가열온도 및 가열시간, 가열 후 제품온도를 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('SYRUP_HEATING', 'SYRUP_HEATING_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3),

-- 세척 공정
('WASHING', 'WASHING_Q1', '종사자가 주기적으로 원료량 및 세척수량, 세척시간, 세척수 교체주기를 확인하고, 그 내용을 기록하고 있습니까?', 'STANDARD', 'CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다.', 1),
('WASHING', 'WASHING_Q2', '종사자가 원료량 및 세척방법, 세척수량, 세척시간, 세척수 교체주기를 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('WASHING', 'WASHING_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3),

-- 금속검출 공정
('METAL_DETECTION', 'METAL_DETECTION_Q1', '종사자가 주기적으로 테스트피스를 통해 금속검출기의 감도 이상 유무를 확인하고 있습니까?', 'STANDARD', '테스트피스 점검 기록 및 작업 관찰을 통해 확인합니다.', 1),
('METAL_DETECTION', 'METAL_DETECTION_Q2', '종사자가 금속검출기 감도를 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('METAL_DETECTION', 'METAL_DETECTION_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3),
('METAL_DETECTION', 'METAL_DETECTION_Q4', '금속검출기는 연 1회 검·교정(또는 정기점검)이 이루어지고 있습니까?', 'CALIBRATION', '검교정 성적서 또는 정기점검 기록 확인', 4),

-- 냉각 공정
('COOLING', 'COOLING_Q1', '종사자가 주기적으로 냉각온도 및 냉각시간을 확인하고 그 내용을 기록하고 있습니까?', 'STANDARD', 'CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다.', 1),
('COOLING', 'COOLING_Q2', '종사자가 냉각온도 및 냉각시간을 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('COOLING', 'COOLING_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3),

-- 포장 공정
('PACKAGING', 'PACKAGING_Q1', '종사자가 주기적으로 포장 밀봉 상태 및 표시사항을 확인하고 그 내용을 기록하고 있습니까?', 'STANDARD', 'CCP 모니터링 기록을 확인하여 주기적인 기록 여부를 점검합니다.', 1),
('PACKAGING', 'PACKAGING_Q2', '종사자가 포장 밀봉 상태 및 표시사항을 확인하는 방법을 정확히 알고 있습니까?', 'STANDARD', '종사자 인터뷰 또는 작업 관찰을 통해 확인합니다.', 2),
('PACKAGING', 'PACKAGING_Q3', '종사자가 한계기준 이탈 시 실시해야 하는 개선조치 방법을 알고 있으며, 이탈 및 개선조치 내용이 기록되고 있습니까?', 'STANDARD', '개선조치 절차서 숙지 여부 및 이탈 기록 확인', 3)
ON CONFLICT DO NOTHING;

-- 15. 기본 데이터 삽입 - 공통 검증 질문 (장비 검교정)
INSERT INTO ccp_common_question_templates (question_code, question_text, question_category, equipment_type, calibration_frequency, help_text, sort_order) VALUES
('COMMON_CALIBRATION_THERMOMETER', '온도계는 연 1회 이상 검·교정이 이루어지고 있습니까?', 'CALIBRATION', 'THERMOMETER', 'YEARLY', '검교정 성적서 또는 내부 검증 기록 확인', 1),
('COMMON_CALIBRATION_SCALE', '저울은 연 1회 이상 검·교정이 이루어지고 있습니까?', 'CALIBRATION', 'SCALE', 'YEARLY', '검교정 성적서 또는 내부 검증 기록 확인', 2),
('COMMON_CALIBRATION_TIMER', '타이머는 연 1회 이상 검·교정이 이루어지고 있습니까?', 'CALIBRATION', 'TIMER', 'YEARLY', '검교정 성적서 또는 내부 검증 기록 확인', 3),
('COMMON_CALIBRATION_WASH_TANK', '세척조 용량은 연 1회 이상 검·교정이 이루어지고 있습니까?', 'CALIBRATION', 'WASH_TANK', 'YEARLY', '검교정 성적서 또는 내부 검증 기록 확인', 4),
('COMMON_CALIBRATION_METAL_DETECTOR', '금속검출기는 연 1회 이상 검·교정이 이루어지고 있습니까?', 'CALIBRATION', 'METAL_DETECTOR', 'YEARLY', '검교정 성적서 또는 정기점검 기록 확인', 5)
ON CONFLICT (question_code) DO NOTHING;

-- 16. 회사 초기화 함수 (공정 유형 및 질문 템플릿 복사)
CREATE OR REPLACE FUNCTION initialize_ccp_verification_templates(p_company_id UUID)
RETURNS void AS $$
DECLARE
    v_process_type_id UUID;
    v_template RECORD;
    v_question RECORD;
BEGIN
    -- 공정 유형 템플릿 복사
    FOR v_template IN SELECT * FROM ccp_process_type_templates ORDER BY sort_order LOOP
        INSERT INTO ccp_process_types (company_id, code, name, description, parameters, sort_order)
        VALUES (p_company_id, v_template.code, v_template.name, v_template.description, v_template.parameters, v_template.sort_order)
        ON CONFLICT (company_id, code) DO NOTHING
        RETURNING id INTO v_process_type_id;

        -- 해당 공정의 검증 질문 복사
        IF v_process_type_id IS NOT NULL THEN
            FOR v_question IN SELECT * FROM ccp_verification_question_templates WHERE process_type_code = v_template.code ORDER BY sort_order LOOP
                INSERT INTO ccp_verification_questions (company_id, process_type_id, question_code, question_text, question_category, help_text, sort_order, is_required)
                VALUES (p_company_id, v_process_type_id, v_question.question_code, v_question.question_text, v_question.question_category, v_question.help_text, v_question.sort_order, v_question.is_required)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;

    -- 공통 질문 템플릿 복사
    FOR v_question IN SELECT * FROM ccp_common_question_templates ORDER BY sort_order LOOP
        INSERT INTO ccp_common_verification_questions (company_id, question_code, question_text, question_category, equipment_type, calibration_frequency, help_text, sort_order, is_required)
        VALUES (p_company_id, v_question.question_code, v_question.question_text, v_question.question_category, v_question.equipment_type, v_question.calibration_frequency, v_question.help_text, v_question.sort_order, v_question.is_required)
        ON CONFLICT (company_id, question_code) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 새 회사 등록 시 자동 초기화
CREATE OR REPLACE FUNCTION trigger_initialize_ccp_templates()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_ccp_verification_templates(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_initialize_ccp_templates ON companies;
CREATE TRIGGER tr_initialize_ccp_templates
    AFTER INSERT ON companies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_initialize_ccp_templates();
