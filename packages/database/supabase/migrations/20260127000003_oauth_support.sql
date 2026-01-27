-- ============================================
-- OAuth 지원을 위한 users 테이블 확장
-- ============================================

-- OAuth 프로바이더 컬럼 추가 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'oauth_provider'
  ) THEN
    ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(50);
  END IF;
END $$;

-- 아바타 URL 컬럼 추가 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);

-- 코멘트 추가
COMMENT ON COLUMN users.oauth_provider IS 'OAuth 프로바이더 (google, kakao, etc.)';
COMMENT ON COLUMN users.avatar_url IS '프로필 이미지 URL';

-- Done
SELECT 'OAuth support columns added successfully!' as result;
