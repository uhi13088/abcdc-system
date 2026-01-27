-- ============================================
-- ESP32 IoT Device Registration System
-- ============================================

-- ============================================
-- 1. ESP32 기기 테이블 (ESP32 Devices)
-- Super Admin이 대량 생성하고, 고객이 등록코드로 등록
-- ============================================
CREATE TABLE IF NOT EXISTS esp32_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기기 식별 정보
  device_serial VARCHAR(50) NOT NULL UNIQUE,  -- 기기 시리얼 번호 (제조 시 부여)
  mac_address VARCHAR(17),                     -- MAC 주소 (XX:XX:XX:XX:XX:XX)
  firmware_version VARCHAR(20) DEFAULT '1.0.0',

  -- 등록 코드 시스템
  registration_code VARCHAR(12) NOT NULL UNIQUE,  -- 6자리 등록코드 (예: ABC123)
  registration_code_expires_at TIMESTAMPTZ,       -- 등록코드 만료일

  -- 회사 연결 (등록 후 설정됨)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ,
  registered_by UUID REFERENCES users(id),

  -- 센서 연결
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE SET NULL,

  -- 기기 타입
  device_type VARCHAR(30) DEFAULT 'TEMPERATURE' CHECK (device_type IN (
    'TEMPERATURE',        -- 온도 센서
    'HUMIDITY',          -- 습도 센서
    'TEMPERATURE_HUMIDITY', -- 온습도 복합 센서
    'PH',                -- pH 센서
    'PRESSURE',          -- 압력 센서
    'CO2',               -- CO2 센서
    'DOOR',              -- 도어 센서
    'WATER_LEAK',        -- 누수 센서
    'OTHER'
  )),

  -- 기기 상태
  status VARCHAR(20) DEFAULT 'UNREGISTERED' CHECK (status IN (
    'UNREGISTERED',    -- 생성됨, 등록 대기
    'REGISTERED',      -- 등록 완료
    'ACTIVE',          -- 활성화 (데이터 전송 중)
    'OFFLINE',         -- 오프라인 (연결 끊김)
    'MAINTENANCE',     -- 유지보수 중
    'DEACTIVATED'      -- 비활성화
  )),

  -- 연결 정보
  last_seen_at TIMESTAMPTZ,
  last_ip_address VARCHAR(45),
  wifi_ssid VARCHAR(100),
  wifi_signal_strength INTEGER,  -- dBm

  -- 설정
  reading_interval_seconds INTEGER DEFAULT 60,  -- 측정 주기 (초)
  api_key VARCHAR(64),                          -- 기기별 API 키

  -- 메타데이터
  hardware_info JSONB DEFAULT '{}',  -- 하드웨어 정보
  config JSONB DEFAULT '{}',         -- 추가 설정

  -- 감사 정보
  created_by UUID REFERENCES users(id),  -- 기기 생성자 (Super Admin)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 기기 이벤트 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS esp32_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES esp32_devices(id) ON DELETE CASCADE,

  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'CREATED',           -- 기기 생성
    'REGISTERED',        -- 등록 완료
    'ACTIVATED',         -- 활성화
    'DEACTIVATED',       -- 비활성화
    'CONNECTED',         -- 연결됨
    'DISCONNECTED',      -- 연결 끊김
    'FIRMWARE_UPDATE',   -- 펌웨어 업데이트
    'CONFIG_CHANGED',    -- 설정 변경
    'ERROR',             -- 에러 발생
    'MAINTENANCE_START', -- 유지보수 시작
    'MAINTENANCE_END'    -- 유지보수 종료
  )),

  event_data JSONB DEFAULT '{}',
  ip_address VARCHAR(45),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 기기 배치 생성 테이블 (Batch Provisioning)
-- Super Admin이 대량으로 기기를 생성할 때 사용
-- ============================================
CREATE TABLE IF NOT EXISTS esp32_device_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  batch_name VARCHAR(100) NOT NULL,
  batch_code VARCHAR(20) NOT NULL UNIQUE,  -- 배치 코드 (예: BATCH-2024-001)

  device_type VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL,

  -- 생성된 기기 범위
  serial_prefix VARCHAR(20) NOT NULL,  -- 시리얼 접두사 (예: ESP32-TEMP-)
  serial_start INTEGER NOT NULL,
  serial_end INTEGER NOT NULL,

  -- 메타데이터
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 기기 할당 대기 테이블 (Pre-allocation)
-- 특정 회사에 미리 기기를 할당해둘 때 사용
-- ============================================
CREATE TABLE IF NOT EXISTS esp32_device_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  device_id UUID NOT NULL REFERENCES esp32_devices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  allocated_by UUID REFERENCES users(id),

  notes TEXT,

  UNIQUE(device_id)  -- 한 기기는 하나의 회사에만 할당 가능
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_esp32_devices_company ON esp32_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_status ON esp32_devices(status);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_registration_code ON esp32_devices(registration_code);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_serial ON esp32_devices(device_serial);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_sensor ON esp32_devices(sensor_id);
CREATE INDEX IF NOT EXISTS idx_esp32_device_events_device ON esp32_device_events(device_id);
CREATE INDEX IF NOT EXISTS idx_esp32_device_events_type ON esp32_device_events(event_type);
CREATE INDEX IF NOT EXISTS idx_esp32_device_allocations_company ON esp32_device_allocations(company_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE esp32_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE esp32_device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE esp32_device_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE esp32_device_allocations ENABLE ROW LEVEL SECURITY;

-- ESP32 Devices: 회사별 접근 또는 Super Admin
CREATE POLICY esp32_devices_select_policy ON esp32_devices FOR SELECT USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR company_id IS NULL  -- 미등록 기기도 조회 가능 (등록용)
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY esp32_devices_insert_policy ON esp32_devices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY esp32_devices_update_policy ON esp32_devices FOR UPDATE USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY esp32_devices_delete_policy ON esp32_devices FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Device Events: 회사별 접근 또는 Super Admin
CREATE POLICY esp32_device_events_policy ON esp32_device_events FOR ALL USING (
  device_id IN (
    SELECT id FROM esp32_devices
    WHERE company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Device Batches: Super Admin만
CREATE POLICY esp32_device_batches_policy ON esp32_device_batches FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Device Allocations: 회사별 또는 Super Admin
CREATE POLICY esp32_device_allocations_policy ON esp32_device_allocations FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- Functions
-- ============================================

-- 등록코드 생성 함수
CREATE OR REPLACE FUNCTION generate_registration_code()
RETURNS VARCHAR(12) AS $$
DECLARE
  chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 혼동되는 문자 제외 (0,O,1,I)
  result VARCHAR(12) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 기기 시리얼 생성 함수
CREATE OR REPLACE FUNCTION generate_device_serial(prefix VARCHAR, num INTEGER)
RETURNS VARCHAR(50) AS $$
BEGIN
  RETURN prefix || lpad(num::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- API 키 생성 함수
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS VARCHAR(64) AS $$
DECLARE
  chars VARCHAR(62) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR(64) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..64 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 기기 배치 생성 함수
CREATE OR REPLACE FUNCTION create_device_batch(
  p_batch_name VARCHAR,
  p_device_type VARCHAR,
  p_quantity INTEGER,
  p_serial_prefix VARCHAR,
  p_created_by UUID
)
RETURNS TABLE (
  batch_id UUID,
  batch_code VARCHAR,
  devices_created INTEGER
) AS $$
DECLARE
  v_batch_id UUID;
  v_batch_code VARCHAR;
  v_serial_start INTEGER;
  v_serial_end INTEGER;
  i INTEGER;
  v_reg_code VARCHAR;
BEGIN
  -- 배치 코드 생성
  v_batch_code := 'BATCH-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad((floor(random() * 1000)::int)::text, 3, '0');

  -- 시리얼 번호 범위 계산
  SELECT COALESCE(MAX(serial_end), 0) + 1 INTO v_serial_start
  FROM esp32_device_batches
  WHERE serial_prefix = p_serial_prefix;

  v_serial_end := v_serial_start + p_quantity - 1;

  -- 배치 레코드 생성
  INSERT INTO esp32_device_batches (
    batch_name, batch_code, device_type, quantity,
    serial_prefix, serial_start, serial_end, created_by
  ) VALUES (
    p_batch_name, v_batch_code, p_device_type, p_quantity,
    p_serial_prefix, v_serial_start, v_serial_end, p_created_by
  ) RETURNING id INTO v_batch_id;

  -- 기기들 생성
  FOR i IN v_serial_start..v_serial_end LOOP
    -- 고유한 등록코드 생성
    LOOP
      v_reg_code := generate_registration_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM esp32_devices WHERE registration_code = v_reg_code);
    END LOOP;

    INSERT INTO esp32_devices (
      device_serial,
      registration_code,
      registration_code_expires_at,
      device_type,
      api_key,
      created_by
    ) VALUES (
      generate_device_serial(p_serial_prefix, i),
      v_reg_code,
      NOW() + INTERVAL '1 year',  -- 등록코드 1년 유효
      p_device_type,
      generate_api_key(),
      p_created_by
    );
  END LOOP;

  RETURN QUERY SELECT v_batch_id, v_batch_code, p_quantity;
END;
$$ LANGUAGE plpgsql;

-- 기기 등록 함수 (고객이 등록코드로 등록)
CREATE OR REPLACE FUNCTION register_device(
  p_registration_code VARCHAR,
  p_company_id UUID,
  p_user_id UUID,
  p_device_name VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  device_id UUID,
  sensor_id UUID,
  message VARCHAR
) AS $$
DECLARE
  v_device_id UUID;
  v_sensor_id UUID;
  v_device RECORD;
BEGIN
  -- 기기 찾기
  SELECT * INTO v_device
  FROM esp32_devices
  WHERE registration_code = upper(p_registration_code)
    AND status = 'UNREGISTERED';

  IF v_device IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, '등록코드를 찾을 수 없거나 이미 등록된 기기입니다.'::VARCHAR;
    RETURN;
  END IF;

  -- 등록코드 만료 확인
  IF v_device.registration_code_expires_at IS NOT NULL AND v_device.registration_code_expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, '등록코드가 만료되었습니다.'::VARCHAR;
    RETURN;
  END IF;

  -- 센서 자동 생성
  INSERT INTO iot_sensors (
    company_id,
    sensor_code,
    name,
    sensor_type,
    device_id,
    status,
    alert_enabled
  ) VALUES (
    p_company_id,
    'SENSOR-' || v_device.device_serial,
    COALESCE(p_device_name, v_device.device_type || ' 센서 (' || v_device.device_serial || ')'),
    v_device.device_type,
    v_device.device_serial,
    'ACTIVE',
    true
  ) RETURNING id INTO v_sensor_id;

  -- 기기 업데이트
  UPDATE esp32_devices
  SET
    company_id = p_company_id,
    sensor_id = v_sensor_id,
    status = 'REGISTERED',
    registered_at = NOW(),
    registered_by = p_user_id,
    updated_at = NOW()
  WHERE id = v_device.id
  RETURNING id INTO v_device_id;

  -- 이벤트 로그
  INSERT INTO esp32_device_events (device_id, event_type, event_data)
  VALUES (v_device_id, 'REGISTERED', jsonb_build_object(
    'company_id', p_company_id,
    'user_id', p_user_id,
    'sensor_id', v_sensor_id
  ));

  RETURN QUERY SELECT true, v_device_id, v_sensor_id, '기기가 성공적으로 등록되었습니다.'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- Updated at 트리거
CREATE OR REPLACE FUNCTION update_esp32_device_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER esp32_devices_updated_at
  BEFORE UPDATE ON esp32_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_esp32_device_updated_at();

-- Done
SELECT 'ESP32 Device System created successfully!' as result;
