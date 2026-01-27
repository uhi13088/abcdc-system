-- Email Verification Table for storing verification codes
-- 이메일 인증 코드 저장 테이블

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 이메일당 하나의 활성 코드만 유지
  CONSTRAINT unique_email_verification UNIQUE (email)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- RLS 정책
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- 서비스 역할에서만 접근 가능 (API를 통해서만 접근)
CREATE POLICY "Service role can manage email_verifications"
  ON email_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 익명 사용자도 자신의 이메일 인증 가능하도록 (회원가입 전이므로)
CREATE POLICY "Anyone can insert email_verifications"
  ON email_verifications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can select their own email_verification"
  ON email_verifications
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update their own email_verification"
  ON email_verifications
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete their own email_verification"
  ON email_verifications
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- 만료된 인증 코드 자동 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_expired_email_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 주기적으로 만료된 코드 정리 (pg_cron이 설치되어 있다면)
-- SELECT cron.schedule('cleanup-email-verifications', '*/30 * * * *', 'SELECT cleanup_expired_email_verifications()');

COMMENT ON TABLE email_verifications IS '이메일 인증 코드 저장 테이블';
COMMENT ON COLUMN email_verifications.email IS '인증할 이메일 주소';
COMMENT ON COLUMN email_verifications.code IS '6자리 인증 코드';
COMMENT ON COLUMN email_verifications.verified IS '인증 완료 여부';
COMMENT ON COLUMN email_verifications.expires_at IS '인증 코드 만료 시간';
