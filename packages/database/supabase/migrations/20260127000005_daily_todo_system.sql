-- ============================================
-- Daily Todo System (일일 체크리스트 시스템)
-- ============================================
-- HACCP 근무자를 위한 일일 업무 체크리스트
-- 템플릿 기반으로 매일 체크리스트 생성 가능

-- ============================================
-- 1. 체크리스트 템플릿 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS todo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 템플릿 정보
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 예: '개장준비', '마감', '위생점검', 'CCP점검' 등

  -- 정렬 순서
  sort_order INTEGER DEFAULT 0,

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 생성/수정 정보
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 템플릿 항목 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS todo_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES todo_templates(id) ON DELETE CASCADE,

  -- 항목 정보
  content TEXT NOT NULL,
  description TEXT,

  -- 정렬 순서
  sort_order INTEGER DEFAULT 0,

  -- 필수 여부
  is_required BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 일일 체크리스트 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS daily_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 날짜
  todo_date DATE NOT NULL,

  -- 제목 및 설명
  title VARCHAR(200) NOT NULL,
  description TEXT,

  -- 템플릿에서 생성된 경우
  template_id UUID REFERENCES todo_templates(id) ON DELETE SET NULL,

  -- 상태
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),

  -- 생성자
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- 회사별 날짜별 유니크 제약 (템플릿 기반일 경우)
  UNIQUE(company_id, todo_date, template_id)
);

-- ============================================
-- 4. 일일 체크리스트 항목 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS daily_todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_todo_id UUID NOT NULL REFERENCES daily_todos(id) ON DELETE CASCADE,

  -- 항목 정보
  content TEXT NOT NULL,
  description TEXT,

  -- 정렬 순서
  sort_order INTEGER DEFAULT 0,

  -- 필수 여부
  is_required BOOLEAN DEFAULT false,

  -- 완료 정보
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,

  -- 원본 템플릿 항목 (추적용)
  template_item_id UUID REFERENCES todo_template_items(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_todo_templates_company ON todo_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_todo_templates_category ON todo_templates(company_id, category);
CREATE INDEX IF NOT EXISTS idx_todo_template_items_template ON todo_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_daily_todos_company_date ON daily_todos(company_id, todo_date);
CREATE INDEX IF NOT EXISTS idx_daily_todos_status ON daily_todos(company_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_todo_items_todo ON daily_todo_items(daily_todo_id);
CREATE INDEX IF NOT EXISTS idx_daily_todo_items_completed ON daily_todo_items(daily_todo_id, is_completed);

-- ============================================
-- 6. RLS 정책
-- ============================================
ALTER TABLE todo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_todo_items ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS todo_templates_select_policy ON todo_templates;
DROP POLICY IF EXISTS todo_templates_insert_policy ON todo_templates;
DROP POLICY IF EXISTS todo_templates_update_policy ON todo_templates;
DROP POLICY IF EXISTS todo_templates_delete_policy ON todo_templates;

-- 템플릿 조회: 같은 회사 직원은 모두 조회 가능
CREATE POLICY todo_templates_select_policy ON todo_templates FOR SELECT USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 템플릿 생성/수정/삭제: 검증자 이상만 가능
CREATE POLICY todo_templates_insert_policy ON todo_templates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND company_id = todo_templates.company_id
    AND role IN ('super_admin', 'admin', 'manager', 'verifier')
  )
);

CREATE POLICY todo_templates_update_policy ON todo_templates FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND company_id = todo_templates.company_id
    AND role IN ('super_admin', 'admin', 'manager', 'verifier')
  )
);

CREATE POLICY todo_templates_delete_policy ON todo_templates FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND company_id = todo_templates.company_id
    AND role IN ('super_admin', 'admin', 'manager', 'verifier')
  )
);

-- 템플릿 항목: 템플릿 접근 권한과 동일
DROP POLICY IF EXISTS todo_template_items_select_policy ON todo_template_items;
DROP POLICY IF EXISTS todo_template_items_modify_policy ON todo_template_items;

CREATE POLICY todo_template_items_select_policy ON todo_template_items FOR SELECT USING (
  template_id IN (
    SELECT id FROM todo_templates
    WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY todo_template_items_modify_policy ON todo_template_items FOR ALL USING (
  template_id IN (
    SELECT t.id FROM todo_templates t
    WHERE EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND company_id = t.company_id
      AND role IN ('super_admin', 'admin', 'manager', 'verifier')
    )
  )
);

-- 일일 투두 조회: 같은 회사 직원은 모두 조회 가능
DROP POLICY IF EXISTS daily_todos_select_policy ON daily_todos;
DROP POLICY IF EXISTS daily_todos_insert_policy ON daily_todos;
DROP POLICY IF EXISTS daily_todos_update_policy ON daily_todos;
DROP POLICY IF EXISTS daily_todos_delete_policy ON daily_todos;

CREATE POLICY daily_todos_select_policy ON daily_todos FOR SELECT USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 일일 투두 생성/삭제: 검증자 이상만 가능
CREATE POLICY daily_todos_insert_policy ON daily_todos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND company_id = daily_todos.company_id
    AND role IN ('super_admin', 'admin', 'manager', 'verifier')
  )
);

CREATE POLICY daily_todos_update_policy ON daily_todos FOR UPDATE USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY daily_todos_delete_policy ON daily_todos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND company_id = daily_todos.company_id
    AND role IN ('super_admin', 'admin', 'manager', 'verifier')
  )
);

-- 일일 투두 항목: 모든 직원이 완료 처리 가능
DROP POLICY IF EXISTS daily_todo_items_policy ON daily_todo_items;

CREATE POLICY daily_todo_items_policy ON daily_todo_items FOR ALL USING (
  daily_todo_id IN (
    SELECT id FROM daily_todos
    WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 7. 트리거: updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_todo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS todo_templates_updated_at ON todo_templates;
CREATE TRIGGER todo_templates_updated_at
  BEFORE UPDATE ON todo_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_todo_updated_at();

DROP TRIGGER IF EXISTS daily_todos_updated_at ON daily_todos;
CREATE TRIGGER daily_todos_updated_at
  BEFORE UPDATE ON daily_todos
  FOR EACH ROW
  EXECUTE FUNCTION update_todo_updated_at();

-- ============================================
-- 8. 일일 투두 상태 자동 업데이트 함수
-- ============================================
CREATE OR REPLACE FUNCTION update_daily_todo_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INTEGER;
  completed_count INTEGER;
BEGIN
  -- 해당 투두의 전체 항목 수와 완료 항목 수 계산
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_completed = true)
  INTO total_count, completed_count
  FROM daily_todo_items
  WHERE daily_todo_id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id);

  -- 상태 업데이트
  UPDATE daily_todos
  SET status = CASE
    WHEN completed_count = 0 THEN 'PENDING'
    WHEN completed_count = total_count THEN 'COMPLETED'
    ELSE 'IN_PROGRESS'
  END
  WHERE id = COALESCE(NEW.daily_todo_id, OLD.daily_todo_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_todo_items_status_trigger ON daily_todo_items;
CREATE TRIGGER daily_todo_items_status_trigger
  AFTER INSERT OR UPDATE OF is_completed OR DELETE ON daily_todo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_todo_status();

-- Done
SELECT 'Daily Todo System tables created successfully!' as result;
