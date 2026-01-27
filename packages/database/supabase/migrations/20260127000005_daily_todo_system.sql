-- ============================================
-- Daily To-Do System (일일 업무 체크리스트)
-- ============================================
-- 검증자 이상이 작성하고, 당일 근무자가 완료 처리

-- ============================================
-- 1. To-Do 템플릿 테이블 (재사용 가능한 체크리스트)
-- ============================================
CREATE TABLE IF NOT EXISTS todo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 템플릿 이름 (예: "오픈 준비", "마감 정리", "위생 점검")
  name VARCHAR(100) NOT NULL,

  -- 설명
  description TEXT,

  -- 카테고리 (예: "OPEN", "CLOSE", "HYGIENE", "CUSTOM")
  category VARCHAR(50) DEFAULT 'CUSTOM',

  -- 생성자
  created_by UUID REFERENCES users(id),

  -- 상태
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id, name)
);

-- ============================================
-- 2. To-Do 템플릿 항목 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS todo_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES todo_templates(id) ON DELETE CASCADE,

  -- 항목 내용
  content VARCHAR(500) NOT NULL,

  -- 정렬 순서
  sort_order INTEGER DEFAULT 0,

  -- 카테고리/그룹 (선택적 - 항목 그룹화용)
  category VARCHAR(50),

  -- 필수 여부
  is_required BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. 일일 To-Do 테이블 (템플릿으로부터 생성)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 날짜
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- 원본 템플릿 (선택적 - 템플릿 없이 직접 생성 가능)
  template_id UUID REFERENCES todo_templates(id) ON DELETE SET NULL,

  -- 템플릿 이름 (스냅샷 - 템플릿 삭제되어도 유지)
  name VARCHAR(100) NOT NULL,

  -- 총 항목 수 (캐시)
  total_items INTEGER DEFAULT 0,

  -- 완료 항목 수 (캐시)
  completed_items INTEGER DEFAULT 0,

  -- 생성자 (검증자 이상)
  created_by UUID REFERENCES users(id),

  -- 상태: ACTIVE, COMPLETED, CANCELLED
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 같은 날짜에 같은 이름의 투두 중복 방지
  UNIQUE(company_id, date, name)
);

-- ============================================
-- 4. 일일 To-Do 항목 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS daily_todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_todo_id UUID NOT NULL REFERENCES daily_todos(id) ON DELETE CASCADE,

  -- 항목 내용
  content VARCHAR(500) NOT NULL,

  -- 정렬 순서
  sort_order INTEGER DEFAULT 0,

  -- 카테고리/그룹
  category VARCHAR(50),

  -- 필수 여부
  is_required BOOLEAN DEFAULT TRUE,

  -- 완료 여부
  is_completed BOOLEAN DEFAULT FALSE,

  -- 완료 처리한 사용자
  completed_by UUID REFERENCES users(id),

  -- 완료 시간
  completed_at TIMESTAMP WITH TIME ZONE,

  -- 메모 (완료 시 추가 메모)
  note TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_todo_templates_company ON todo_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_todo_templates_category ON todo_templates(company_id, category);
CREATE INDEX IF NOT EXISTS idx_todo_template_items_template ON todo_template_items(template_id);

CREATE INDEX IF NOT EXISTS idx_daily_todos_company_date ON daily_todos(company_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_todos_status ON daily_todos(company_id, date, status);
CREATE INDEX IF NOT EXISTS idx_daily_todo_items_todo ON daily_todo_items(daily_todo_id);
CREATE INDEX IF NOT EXISTS idx_daily_todo_items_completed ON daily_todo_items(daily_todo_id, is_completed);

-- ============================================
-- 6. RLS 정책
-- ============================================
ALTER TABLE todo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_todo_items ENABLE ROW LEVEL SECURITY;

-- todo_templates: 같은 회사 사용자만 접근
CREATE POLICY todo_templates_policy ON todo_templates FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
);

-- todo_template_items: 템플릿 소속 회사 사용자만 접근
CREATE POLICY todo_template_items_policy ON todo_template_items FOR ALL USING (
  template_id IN (
    SELECT id FROM todo_templates
    WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  )
);

-- daily_todos: 같은 회사 사용자만 접근
CREATE POLICY daily_todos_policy ON daily_todos FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
);

-- daily_todo_items: 투두 소속 회사 사용자만 접근
CREATE POLICY daily_todo_items_policy ON daily_todo_items FOR ALL USING (
  daily_todo_id IN (
    SELECT id FROM daily_todos
    WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  )
);

-- ============================================
-- 7. 트리거: 완료 카운트 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_daily_todo_completion_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 완료 항목 수 업데이트
  UPDATE daily_todos
  SET
    completed_items = (
      SELECT COUNT(*) FROM daily_todo_items
      WHERE daily_todo_id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id)
      AND is_completed = TRUE
    ),
    total_items = (
      SELECT COUNT(*) FROM daily_todo_items
      WHERE daily_todo_id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id)
    ),
    updated_at = NOW(),
    status = CASE
      WHEN (
        SELECT COUNT(*) FROM daily_todo_items
        WHERE daily_todo_id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id)
        AND is_completed = TRUE
      ) = (
        SELECT COUNT(*) FROM daily_todo_items
        WHERE daily_todo_id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id)
      ) THEN 'COMPLETED'
      ELSE 'ACTIVE'
    END
  WHERE id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_todo_item_completion_trigger ON daily_todo_items;
CREATE TRIGGER daily_todo_item_completion_trigger
  AFTER INSERT OR UPDATE OR DELETE ON daily_todo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_todo_completion_count();

-- ============================================
-- 8. 템플릿에서 일일 투두 생성 함수
-- ============================================
CREATE OR REPLACE FUNCTION create_daily_todo_from_template(
  p_template_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_template RECORD;
  v_daily_todo_id UUID;
BEGIN
  -- 템플릿 정보 가져오기
  SELECT * INTO v_template FROM todo_templates WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- 일일 투두 생성
  INSERT INTO daily_todos (company_id, date, template_id, name, created_by)
  VALUES (v_template.company_id, p_date, p_template_id, v_template.name, p_created_by)
  RETURNING id INTO v_daily_todo_id;

  -- 템플릿 항목들 복사
  INSERT INTO daily_todo_items (daily_todo_id, content, sort_order, category, is_required)
  SELECT
    v_daily_todo_id,
    content,
    sort_order,
    category,
    is_required
  FROM todo_template_items
  WHERE template_id = p_template_id
  ORDER BY sort_order;

  RETURN v_daily_todo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE todo_templates IS '재사용 가능한 To-Do 템플릿';
COMMENT ON TABLE todo_template_items IS 'To-Do 템플릿의 개별 항목';
COMMENT ON TABLE daily_todos IS '일일 To-Do 리스트';
COMMENT ON TABLE daily_todo_items IS '일일 To-Do의 개별 항목';

SELECT 'Daily Todo System created successfully!' as result;
