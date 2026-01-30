-- ============================================
-- 팀 관리 시스템 확장
-- 팀 구조, 팀원 관리, 팀별 체크리스트 할당
-- ============================================

-- 1. teams 테이블 확장
-- ============================================

-- 팀 유형 ENUM
DO $$ BEGIN
  CREATE TYPE team_type AS ENUM (
    'barista',      -- 바리스타팀
    'kitchen',      -- 주방팀
    'hall',         -- 홀팀
    'production',   -- 생산팀
    'quality',      -- 품질관리팀
    'warehouse',    -- 창고팀
    'delivery',     -- 배송팀
    'cleaning',     -- 청소팀
    'other'         -- 기타
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- teams 테이블에 컬럼 추가
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS team_type team_type DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_teams_company_active ON teams(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_teams_store_active ON teams(store_id, is_active);

-- 2. team_members 테이블 (팀원 관리 - 다대다 관계)
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_role VARCHAR(20) NOT NULL CHECK (team_role IN ('leader', 'member')) DEFAULT 'member',
  is_primary_team BOOLEAN DEFAULT true,  -- 주 소속 팀 여부
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(team_id, team_role);

-- 3. team_checklists 테이블 (팀별 체크리스트 할당)
-- ============================================

-- 체크리스트 카테고리 ENUM
DO $$ BEGIN
  CREATE TYPE checklist_category AS ENUM (
    'hygiene',          -- 위생점검
    'ccp',              -- CCP 모니터링
    'equipment',        -- 장비 온도
    'pest_control',     -- 방충방서
    'storage',          -- 보관창고
    'production',       -- 생산관리
    'cleaning',         -- 청소
    'opening',          -- 오픈 체크
    'closing',          -- 마감 체크
    'other'             -- 기타
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS team_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  checklist_name VARCHAR(200) NOT NULL,
  checklist_category checklist_category NOT NULL DEFAULT 'other',
  description TEXT,
  frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'per_shift')),
  shift_time VARCHAR(20) CHECK (shift_time IN ('morning', 'afternoon', 'night', 'all')),
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(team_id, checklist_name)
);

CREATE INDEX IF NOT EXISTS idx_team_checklists_team ON team_checklists(team_id);
CREATE INDEX IF NOT EXISTS idx_team_checklists_category ON team_checklists(checklist_category);
CREATE INDEX IF NOT EXISTS idx_team_checklists_company_active ON team_checklists(company_id, is_active);

-- 4. team_checklist_items 테이블 (체크리스트 항목)
-- ============================================
CREATE TABLE IF NOT EXISTS team_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES team_checklists(id) ON DELETE CASCADE,
  item_name VARCHAR(300) NOT NULL,
  item_type VARCHAR(20) DEFAULT 'checkbox' CHECK (item_type IN ('checkbox', 'number', 'text', 'temperature', 'photo')),
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  min_value DECIMAL(10,2),  -- 숫자/온도 타입일 때 최소값
  max_value DECIMAL(10,2),  -- 숫자/온도 타입일 때 최대값
  unit VARCHAR(20),         -- 단위 (°C, kg 등)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(checklist_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON team_checklist_items(checklist_id);

-- 5. team_checklist_records 테이블 (체크리스트 수행 기록)
-- ============================================
CREATE TABLE IF NOT EXISTS team_checklist_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES team_checklists(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_time VARCHAR(20) CHECK (shift_time IN ('morning', 'afternoon', 'night')),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'verified')),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklist_records_team ON team_checklist_records(team_id);
CREATE INDEX IF NOT EXISTS idx_checklist_records_date ON team_checklist_records(record_date);
CREATE INDEX IF NOT EXISTS idx_checklist_records_user ON team_checklist_records(performed_by);
CREATE INDEX IF NOT EXISTS idx_checklist_records_company_date ON team_checklist_records(company_id, record_date);

-- 6. team_checklist_record_items 테이블 (체크리스트 항목별 기록)
-- ============================================
CREATE TABLE IF NOT EXISTS team_checklist_record_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES team_checklist_records(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES team_checklist_items(id) ON DELETE CASCADE,
  is_checked BOOLEAN DEFAULT false,
  value_text TEXT,
  value_number DECIMAL(10,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(record_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_record_items_record ON team_checklist_record_items(record_id);

-- 7. RLS 정책
-- ============================================

-- team_members RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_select ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.company_id = u.company_id
        )
      )
    )
  );

CREATE POLICY team_members_insert ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('super_admin', 'company_admin', 'manager', 'store_manager')
      AND EXISTS (
        SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.company_id = u.company_id
      )
    )
  );

CREATE POLICY team_members_update ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('super_admin', 'company_admin', 'manager', 'store_manager')
      AND EXISTS (
        SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.company_id = u.company_id
      )
    )
  );

CREATE POLICY team_members_delete ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('super_admin', 'company_admin', 'manager', 'store_manager')
      AND EXISTS (
        SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.company_id = u.company_id
      )
    )
  );

-- team_checklists RLS
ALTER TABLE team_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_checklists_select ON team_checklists FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY team_checklists_insert ON team_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('super_admin', 'company_admin', 'manager')
      AND (u.company_id = team_checklists.company_id OR u.role = 'super_admin')
    )
  );

CREATE POLICY team_checklists_update ON team_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('super_admin', 'company_admin', 'manager')
      AND (u.company_id = team_checklists.company_id OR u.role = 'super_admin')
    )
  );

CREATE POLICY team_checklists_delete ON team_checklists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('super_admin', 'company_admin', 'manager')
      AND (u.company_id = team_checklists.company_id OR u.role = 'super_admin')
    )
  );

-- team_checklist_items RLS
ALTER TABLE team_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_checklist_items_select ON team_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_checklists tc
      JOIN users u ON u.auth_id = auth.uid()
      WHERE tc.id = team_checklist_items.checklist_id
      AND (tc.company_id = u.company_id OR u.role = 'super_admin')
    )
  );

CREATE POLICY team_checklist_items_modify ON team_checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_checklists tc
      JOIN users u ON u.auth_id = auth.uid()
      WHERE tc.id = team_checklist_items.checklist_id
      AND u.role IN ('super_admin', 'company_admin', 'manager')
      AND (tc.company_id = u.company_id OR u.role = 'super_admin')
    )
  );

-- team_checklist_records RLS
ALTER TABLE team_checklist_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_checklist_records_select ON team_checklist_records FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY team_checklist_records_insert ON team_checklist_records FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY team_checklist_records_update ON team_checklist_records FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

-- team_checklist_record_items RLS
ALTER TABLE team_checklist_record_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_checklist_record_items_select ON team_checklist_record_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_checklist_records tcr
      JOIN users u ON u.auth_id = auth.uid()
      WHERE tcr.id = team_checklist_record_items.record_id
      AND (tcr.company_id = u.company_id OR u.role = 'super_admin')
    )
  );

CREATE POLICY team_checklist_record_items_modify ON team_checklist_record_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_checklist_records tcr
      JOIN users u ON u.auth_id = auth.uid()
      WHERE tcr.id = team_checklist_record_items.record_id
      AND tcr.company_id = u.company_id
    )
  );

-- 8. 팀 유형별 기본 라벨 함수
-- ============================================
CREATE OR REPLACE FUNCTION get_team_type_label(t_type team_type)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE t_type
    WHEN 'barista' THEN '바리스타팀'
    WHEN 'kitchen' THEN '주방팀'
    WHEN 'hall' THEN '홀팀'
    WHEN 'production' THEN '생산팀'
    WHEN 'quality' THEN '품질관리팀'
    WHEN 'warehouse' THEN '창고팀'
    WHEN 'delivery' THEN '배송팀'
    WHEN 'cleaning' THEN '청소팀'
    ELSE '기타'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. 업데이트 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_team_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teams_updated_at ON teams;
CREATE TRIGGER trigger_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_team_updated_at();

DROP TRIGGER IF EXISTS trigger_team_members_updated_at ON team_members;
CREATE TRIGGER trigger_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_updated_at();

DROP TRIGGER IF EXISTS trigger_team_checklists_updated_at ON team_checklists;
CREATE TRIGGER trigger_team_checklists_updated_at
  BEFORE UPDATE ON team_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_team_updated_at();

DROP TRIGGER IF EXISTS trigger_team_checklist_records_updated_at ON team_checklist_records;
CREATE TRIGGER trigger_team_checklist_records_updated_at
  BEFORE UPDATE ON team_checklist_records
  FOR EACH ROW
  EXECUTE FUNCTION update_team_updated_at();

-- 10. 코멘트
-- ============================================
COMMENT ON TABLE team_members IS '팀원 관리 테이블 - 사용자와 팀의 다대다 관계';
COMMENT ON TABLE team_checklists IS '팀별 체크리스트 템플릿';
COMMENT ON TABLE team_checklist_items IS '체크리스트 항목 정의';
COMMENT ON TABLE team_checklist_records IS '체크리스트 수행 기록';
COMMENT ON TABLE team_checklist_record_items IS '체크리스트 항목별 수행 결과';
