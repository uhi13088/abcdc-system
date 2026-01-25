-- CCP 기록과 개선조치 연결
-- CCP 이탈 시 자동 생성된 개선조치를 추적

-- 1. ccp_records 테이블에 개선조치 연결 컬럼 추가
ALTER TABLE ccp_records
ADD COLUMN IF NOT EXISTS corrective_action_id UUID REFERENCES corrective_actions(id) ON DELETE SET NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_ccp_records_corrective_action
ON ccp_records(corrective_action_id)
WHERE corrective_action_id IS NOT NULL;

-- 컬럼 코멘트
COMMENT ON COLUMN ccp_records.corrective_action_id IS 'CCP 이탈 시 생성된 개선조치 ID';

-- 2. corrective_actions 테이블 개선 (워크플로우 지원)
ALTER TABLE corrective_actions
ADD COLUMN IF NOT EXISTS issue_severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (issue_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
ADD COLUMN IF NOT EXISTS workflow JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS effectiveness_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN corrective_actions.issue_severity IS '문제 심각도';
COMMENT ON COLUMN corrective_actions.workflow IS '워크플로우 단계별 진행 상태';
COMMENT ON COLUMN corrective_actions.effectiveness_verified IS '효과성 검증 여부';

-- 3. CCP 이탈 현황 뷰
CREATE OR REPLACE VIEW ccp_deviation_summary AS
SELECT
  cr.company_id,
  cr.ccp_id,
  cd.ccp_number,
  cd.process,
  DATE_TRUNC('month', cr.record_date) AS month,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN cr.is_within_limit = FALSE THEN 1 END) AS deviation_count,
  ROUND(
    (COUNT(CASE WHEN cr.is_within_limit = FALSE THEN 1 END)::DECIMAL / COUNT(*)) * 100,
    2
  ) AS deviation_rate,
  COUNT(CASE WHEN ca.status IN ('VERIFIED', 'CLOSED') THEN 1 END) AS resolved_count
FROM ccp_records cr
JOIN ccp_definitions cd ON cr.ccp_id = cd.id
LEFT JOIN corrective_actions ca ON cr.corrective_action_id = ca.id
GROUP BY cr.company_id, cr.ccp_id, cd.ccp_number, cd.process, DATE_TRUNC('month', cr.record_date)
ORDER BY month DESC, ccp_number;

-- 4. 미처리 개선조치 알림 트리거 함수
CREATE OR REPLACE FUNCTION notify_overdue_corrective_actions()
RETURNS TRIGGER AS $$
BEGIN
  -- 기한 초과된 개선조치에 대해 알림 생성
  IF NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('VERIFIED', 'CLOSED') THEN
    IF NEW.responsible_person IS NOT NULL THEN
      INSERT INTO notifications (user_id, category, priority, title, body, deep_link)
      VALUES (
        NEW.responsible_person,
        'HACCP',
        'HIGH',
        '개선조치 기한 초과',
        '개선조치 ' || NEW.action_number || '의 완료 기한이 초과되었습니다.',
        '/corrective-actions'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_overdue_corrective_actions'
  ) THEN
    CREATE TRIGGER trg_notify_overdue_corrective_actions
    AFTER UPDATE OF status ON corrective_actions
    FOR EACH ROW
    EXECUTE FUNCTION notify_overdue_corrective_actions();
  END IF;
END;
$$;

-- 5. 개선조치 통계 뷰
CREATE OR REPLACE VIEW corrective_action_stats AS
SELECT
  company_id,
  source_type,
  COUNT(*) AS total_count,
  COUNT(CASE WHEN status = 'OPEN' THEN 1 END) AS open_count,
  COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) AS in_progress_count,
  COUNT(CASE WHEN status IN ('COMPLETED', 'VERIFIED', 'CLOSED') THEN 1 END) AS completed_count,
  COUNT(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('VERIFIED', 'CLOSED') THEN 1 END) AS overdue_count,
  AVG(
    CASE
      WHEN verification_date IS NOT NULL AND action_date IS NOT NULL
      THEN verification_date - action_date
    END
  )::INTEGER AS avg_resolution_days
FROM corrective_actions
GROUP BY company_id, source_type;
