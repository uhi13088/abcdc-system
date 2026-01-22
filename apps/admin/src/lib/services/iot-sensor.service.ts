/**
 * IoT 센서 연동 서비스
 * BLE/WiFi 센서 연결 및 CCP 자동 기록
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { pushNotificationService } from '@abc/shared/server';

let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabaseClient;
}

// Lazy-loaded supabase client accessor
const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  }
});

export interface Sensor {
  id: string;
  companyId: string;
  sensorName: string;
  sensorType: 'TEMPERATURE' | 'HUMIDITY' | 'PH' | 'CHLORINE' | 'WEIGHT';
  protocol: 'BLE' | 'WIFI' | 'MQTT' | 'HTTP';
  connectionString?: string;
  deviceId?: string;
  location?: string;
  storeId?: string;
  ccpDefinitionId?: string;
  readingIntervalSeconds: number;
  alertEnabled: boolean;
  calibrationOffset: number;
  lastCalibratedAt?: Date;
  calibrationDueAt?: Date;
  isActive: boolean;
  lastReadingAt?: Date;
  lastReadingValue?: number;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
}

export interface SensorData {
  sensorId: string;
  value: number;
  unit: string;
  timestamp: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: Record<string, any>;
}

export interface CCPDefinition {
  id: string;
  process: string;
  criticalLimit: {
    min?: number;
    max?: number;
    unit: string;
  };
}

export class IoTSensorService {
  /**
   * 센서 목록 조회
   */
  async getSensors(companyId: string): Promise<Sensor[]> {
    const { data, error } = await supabase
      .from('iot_sensors')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sensor_name');

    if (error) throw error;

    return (data || []).map(this.mapSensor);
  }

  /**
   * 센서 등록
   */
  async registerSensor(
    companyId: string,
    sensorData: Partial<Sensor>
  ): Promise<Sensor> {
    const { data, error } = await supabase
      .from('iot_sensors')
      .insert({
        company_id: companyId,
        sensor_name: sensorData.sensorName,
        sensor_type: sensorData.sensorType,
        protocol: sensorData.protocol,
        connection_string: sensorData.connectionString,
        device_id: sensorData.deviceId,
        location: sensorData.location,
        store_id: sensorData.storeId,
        ccp_definition_id: sensorData.ccpDefinitionId,
        reading_interval_seconds: sensorData.readingIntervalSeconds || 60,
        alert_enabled: sensorData.alertEnabled ?? true,
        calibration_offset: sensorData.calibrationOffset || 0,
        is_active: true,
        status: 'UNKNOWN',
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapSensor(data);
  }

  /**
   * 센서 데이터 기록
   */
  async recordReading(sensorData: SensorData): Promise<void> {
    // 센서 정보 조회
    const { data: sensor, error: sensorError } = await supabase
      .from('iot_sensors')
      .select('*, ccp_definition:ccp_definitions(*)')
      .eq('id', sensorData.sensorId)
      .single();

    if (sensorError || !sensor) {
      throw new Error('Sensor not found');
    }

    // 보정값 적용
    const adjustedValue = sensorData.value + (sensor.calibration_offset || 0);

    // CCP 한계 확인
    let isWithinLimit = true;
    if (sensor.ccp_definition) {
      const limit = sensor.ccp_definition.critical_limit;
      if (limit.min !== undefined && adjustedValue < limit.min) {
        isWithinLimit = false;
      }
      if (limit.max !== undefined && adjustedValue > limit.max) {
        isWithinLimit = false;
      }
    }

    // 센서 데이터 저장
    await supabase.from('sensor_readings').insert({
      sensor_id: sensorData.sensorId,
      reading_value: adjustedValue,
      reading_unit: sensorData.unit,
      is_within_limit: isWithinLimit,
      raw_data: sensorData.rawData,
      recorded_at: sensorData.timestamp.toISOString(),
    });

    // 센서 상태 업데이트
    await supabase
      .from('iot_sensors')
      .update({
        last_reading_at: sensorData.timestamp.toISOString(),
        last_reading_value: adjustedValue,
        status: 'ONLINE',
      })
      .eq('id', sensorData.sensorId);

    // CCP 자동 기록
    if (sensor.ccp_definition_id) {
      await this.autoRecordCCP(sensor, adjustedValue, sensorData.unit, isWithinLimit);
    }

    // 한계 초과 시 알림
    if (!isWithinLimit && sensor.alert_enabled) {
      await this.sendCriticalAlert(sensor, adjustedValue);
    }
  }

  /**
   * CCP 자동 기록
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async autoRecordCCP(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sensor: any,
    value: number,
    unit: string,
    isWithinLimit: boolean
  ): Promise<void> {
    const now = new Date();

    await supabase.from('ccp_records').insert({
      ccp_id: sensor.ccp_definition_id,
      company_id: sensor.company_id,
      store_id: sensor.store_id,
      record_date: now.toISOString().split('T')[0],
      record_time: now.toTimeString().split(' ')[0],
      measurement: {
        value,
        unit,
        result: isWithinLimit ? 'PASS' : 'FAIL',
      },
      recorded_by_sensor: sensor.id,
      auto_recorded: true,
    });
  }

  /**
   * 한계 초과 알림
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendCriticalAlert(sensor: any, value: number): Promise<void> {
    // HACCP 담당자들에게 알림
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', sensor.company_id)
      .in('role', ['HACCP_MANAGER', 'STORE_MANAGER', 'COMPANY_ADMIN']);

    const ccpName = sensor.ccp_definition?.process || '센서';
    const unit = sensor.ccp_definition?.critical_limit?.unit || '';
    const limit = sensor.ccp_definition?.critical_limit;
    const limitText = limit
      ? `(한계: ${limit.min || ''}~${limit.max || ''}${unit})`
      : '';

    for (const user of users || []) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        category: 'HACCP',
        priority: 'HIGH',
        title: 'CCP 한계 초과 경고',
        body: `${sensor.location || sensor.sensor_name}: ${ccpName} ${value}${unit} ${limitText}`,
        deep_link: `/haccp/ccp/${sensor.ccp_definition_id}`,
        sent: false,
      });
    }

    // FCM 푸시 알림
    const { data: fcmTokens } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .in('user_id', (users || []).map(u => u.id))
      .eq('is_active', true);

    for (const token of fcmTokens || []) {
      try {
        await pushNotificationService.send(token.fcm_token, {
          title: 'CCP 한계 초과 경고',
          body: `${sensor.location}: ${value}${unit}`,
          category: 'HACCP',
          priority: 'HIGH',
        });
      } catch (e) {
        console.error('Push notification failed:', e);
      }
    }
  }

  /**
   * 센서 상태 확인 (오프라인 감지)
   */
  async checkSensorHealth(companyId: string): Promise<{
    online: number;
    offline: number;
    error: number;
    offlineSensors: Sensor[];
  }> {
    const sensors = await this.getSensors(companyId);
    const now = new Date();
    const offlineThreshold = 5 * 60 * 1000; // 5분

    const offlineSensors: Sensor[] = [];
    let online = 0;
    let offline = 0;
    let error = 0;

    for (const sensor of sensors) {
      if (sensor.status === 'ERROR') {
        error++;
      } else if (
        sensor.lastReadingAt &&
        now.getTime() - new Date(sensor.lastReadingAt).getTime() < offlineThreshold
      ) {
        online++;
      } else {
        offline++;
        offlineSensors.push(sensor);

        // 오프라인으로 상태 업데이트
        if (sensor.status !== 'OFFLINE') {
          await supabase
            .from('iot_sensors')
            .update({ status: 'OFFLINE' })
            .eq('id', sensor.id);
        }
      }
    }

    return { online, offline, error, offlineSensors };
  }

  /**
   * 센서 보정
   */
  async calibrateSensor(
    sensorId: string,
    offset: number,
    nextCalibrationDate?: Date
  ): Promise<void> {
    await supabase
      .from('iot_sensors')
      .update({
        calibration_offset: offset,
        last_calibrated_at: new Date().toISOString(),
        calibration_due_at: nextCalibrationDate?.toISOString(),
      })
      .eq('id', sensorId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSensor(data: any): Sensor {
    return {
      id: data.id,
      companyId: data.company_id,
      sensorName: data.sensor_name,
      sensorType: data.sensor_type,
      protocol: data.protocol,
      connectionString: data.connection_string,
      deviceId: data.device_id,
      location: data.location,
      storeId: data.store_id,
      ccpDefinitionId: data.ccp_definition_id,
      readingIntervalSeconds: data.reading_interval_seconds,
      alertEnabled: data.alert_enabled,
      calibrationOffset: data.calibration_offset,
      lastCalibratedAt: data.last_calibrated_at ? new Date(data.last_calibrated_at) : undefined,
      calibrationDueAt: data.calibration_due_at ? new Date(data.calibration_due_at) : undefined,
      isActive: data.is_active,
      lastReadingAt: data.last_reading_at ? new Date(data.last_reading_at) : undefined,
      lastReadingValue: data.last_reading_value,
      status: data.status,
    };
  }
}

export const iotSensorService = new IoTSensorService();

export default IoTSensorService;
