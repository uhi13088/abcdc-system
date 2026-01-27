/**
 * Calibration Alerts Cron Job
 * 센서 및 장비 교정 만료 관리 자동화
 *
 * 기능:
 * 1. 교정 만료 30일 전 알림 생성
 * 2. 교정 만료된 센서/장비 자동 비활성화
 * 3. 관리자에게 알림 발송
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AlertResult {
  sensors: {
    expiringSoon: number;
    expired: number;
    deactivated: number;
  };
  equipment: {
    expiringSoon: number;
    expired: number;
  };
  notifications: number;
}

const logger = {
  // eslint-disable-next-line no-console
  log: (message: string) => console.log(`[${new Date().toISOString()}] ${message}`),
  // eslint-disable-next-line no-console
  error: (message: string, error?: unknown) => console.error(`[${new Date().toISOString()}] ${message}`, error),
};

export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

    // 모든 회사 조회
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');

    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'No companies found' });
    }

    const results: Record<string, AlertResult> = {};

    for (const company of companies) {
      const result: AlertResult = {
        sensors: { expiringSoon: 0, expired: 0, deactivated: 0 },
        equipment: { expiringSoon: 0, expired: 0 },
        notifications: 0,
      };

      // ========================================
      // 1. 센서 교정 만료 체크
      // ========================================

      // 1-1. 30일 이내 만료 예정 센서
      const { data: expiringSensors } = await supabase
        .from('iot_sensors')
        .select('id, sensor_name, calibration_due_at, location')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .not('calibration_due_at', 'is', null)
        .lte('calibration_due_at', thirtyDaysLaterStr)
        .gt('calibration_due_at', today);

      result.sensors.expiringSoon = expiringSensors?.length || 0;

      // 1-2. 이미 만료된 센서 (비활성화 처리)
      const { data: expiredSensors } = await supabase
        .from('iot_sensors')
        .select('id, sensor_name, calibration_due_at, location')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .not('calibration_due_at', 'is', null)
        .lt('calibration_due_at', today);

      result.sensors.expired = expiredSensors?.length || 0;

      // 만료된 센서 비활성화
      if (expiredSensors && expiredSensors.length > 0) {
        const expiredIds = expiredSensors.map(s => s.id);
        await supabase
          .from('iot_sensors')
          .update({
            is_active: false,
            status: 'CALIBRATION_EXPIRED',
            updated_at: new Date().toISOString(),
          })
          .in('id', expiredIds);

        result.sensors.deactivated = expiredIds.length;
        logger.log(`[Calibration] Deactivated ${expiredIds.length} expired sensors for company ${company.name}`);
      }

      // ========================================
      // 2. 장비 교정 만료 체크
      // ========================================

      // 2-1. 30일 이내 만료 예정 장비
      const { data: expiringEquipment } = await supabase
        .from('equipment_calibration_records')
        .select('id, equipment_name, equipment_type, next_calibration_date, location')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .not('next_calibration_date', 'is', null)
        .lte('next_calibration_date', thirtyDaysLaterStr)
        .gt('next_calibration_date', today);

      result.equipment.expiringSoon = expiringEquipment?.length || 0;

      // 2-2. 이미 만료된 장비
      const { data: expiredEquipment } = await supabase
        .from('equipment_calibration_records')
        .select('id, equipment_name, equipment_type, next_calibration_date, location')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .not('next_calibration_date', 'is', null)
        .lt('next_calibration_date', today);

      result.equipment.expired = expiredEquipment?.length || 0;

      // ========================================
      // 3. 관리자에게 알림 생성
      // ========================================
      const { data: managers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', company.id)
        .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

      // 만료 예정 센서 알림
      if (expiringSensors && expiringSensors.length > 0) {
        const sensorList = expiringSensors
          .slice(0, 5)
          .map(s => `${s.sensor_name} (만료: ${s.calibration_due_at})`)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CALIBRATION',
            priority: 'MEDIUM',
            title: `센서 교정 만료 예정 (${expiringSensors.length}건)`,
            message: `교정 만료가 임박한 센서가 있습니다: ${sensorList}${expiringSensors.length > 5 ? ` 외 ${expiringSensors.length - 5}건` : ''}`,
            action_url: '/sensors',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 만료된 센서 알림 (긴급)
      if (expiredSensors && expiredSensors.length > 0) {
        const sensorList = expiredSensors
          .slice(0, 3)
          .map(s => s.sensor_name)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CALIBRATION',
            priority: 'HIGH',
            title: `⚠️ 센서 교정 만료 - 자동 비활성화됨 (${expiredSensors.length}건)`,
            message: `교정이 만료되어 다음 센서가 비활성화되었습니다: ${sensorList}${expiredSensors.length > 3 ? ` 외 ${expiredSensors.length - 3}건` : ''}. 교정 완료 후 다시 활성화하세요.`,
            action_url: '/sensors',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 만료 예정 장비 알림
      if (expiringEquipment && expiringEquipment.length > 0) {
        const equipList = expiringEquipment
          .slice(0, 5)
          .map(e => `${e.equipment_name} (만료: ${e.next_calibration_date})`)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CALIBRATION',
            priority: 'MEDIUM',
            title: `장비 교정 만료 예정 (${expiringEquipment.length}건)`,
            message: `교정 만료가 임박한 장비가 있습니다: ${equipList}${expiringEquipment.length > 5 ? ` 외 ${expiringEquipment.length - 5}건` : ''}`,
            action_url: '/ccp/equipment-calibration',
            is_read: false,
          });
          result.notifications++;
        }
      }

      // 만료된 장비 알림 (긴급)
      if (expiredEquipment && expiredEquipment.length > 0) {
        const equipList = expiredEquipment
          .slice(0, 3)
          .map(e => e.equipment_name)
          .join(', ');

        for (const manager of managers || []) {
          await supabase.from('notifications').insert({
            user_id: manager.id,
            category: 'CALIBRATION',
            priority: 'HIGH',
            title: `⚠️ 장비 교정 만료 (${expiredEquipment.length}건)`,
            message: `교정이 만료된 장비가 있습니다: ${equipList}${expiredEquipment.length > 3 ? ` 외 ${expiredEquipment.length - 3}건` : ''}. 즉시 교정을 진행해주세요.`,
            action_url: '/ccp/equipment-calibration',
            is_read: false,
          });
          result.notifications++;
        }
      }

      results[company.id] = result;
    }

    const duration = Date.now() - startTime;
    logger.log(`[Calibration Alerts] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results,
    });
  } catch (error) {
    logger.error('[Calibration Alerts] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
