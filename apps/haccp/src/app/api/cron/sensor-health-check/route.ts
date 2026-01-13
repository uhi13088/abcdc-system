/**
 * Cron: IoT Sensor Health Check
 * 5분마다 실행되어 센서 상태 체크 및 오프라인 알림
 * Schedule: every 5 minutes
 */

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Offline threshold: 5 minutes
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export async function GET() {
  console.log('[Cron] Starting sensor health check...');

  try {
    const now = new Date();
    const offlineThreshold = new Date(now.getTime() - OFFLINE_THRESHOLD_MS);

    const results = {
      total: 0,
      online: 0,
      offline: 0,
      newOffline: 0,
      errors: 0,
    };

    // Get all active sensors
    const { data: sensors, error: fetchError } = await getSupabase()
      .from('iot_sensors')
      .select('*, company:companies(name)')
      .eq('is_active', true);

    if (fetchError) {
      throw fetchError;
    }

    results.total = sensors?.length || 0;

    // Group sensors by company for batch notifications
    const offlineSensorsByCompany: Record<string, string[]> = {};

    for (const sensor of sensors || []) {
      const lastReading = sensor.last_reading_at
        ? new Date(sensor.last_reading_at)
        : null;

      if (!lastReading || lastReading < offlineThreshold) {
        // Sensor is offline
        results.offline++;

        // Check if this is a new offline status (wasn't already OFFLINE)
        if (sensor.status !== 'OFFLINE') {
          results.newOffline++;

          // Update sensor status to OFFLINE
          await getSupabase()
            .from('iot_sensors')
            .update({ status: 'OFFLINE' })
            .eq('id', sensor.id);

          // Add to notifications list
          if (!offlineSensorsByCompany[sensor.company_id]) {
            offlineSensorsByCompany[sensor.company_id] = [];
          }
          offlineSensorsByCompany[sensor.company_id].push(
            sensor.sensor_name || sensor.location || sensor.id
          );
        }
      } else {
        // Sensor is online
        results.online++;

        // Update status to ONLINE if it was OFFLINE
        if (sensor.status === 'OFFLINE') {
          await getSupabase()
            .from('iot_sensors')
            .update({ status: 'ONLINE' })
            .eq('id', sensor.id);
        }
      }
    }

    // Send notifications for newly offline sensors
    for (const [companyId, sensorNames] of Object.entries(offlineSensorsByCompany)) {
      // Get HACCP managers and admins for this company
      const { data: users } = await getSupabase()
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .in('role', ['HACCP_MANAGER', 'STORE_MANAGER', 'COMPANY_ADMIN']);

      const sensorList = sensorNames.slice(0, 3).join(', ');
      const additionalCount = sensorNames.length > 3 ? ` 외 ${sensorNames.length - 3}개` : '';

      for (const user of users || []) {
        await getSupabase().from('notifications').insert({
          user_id: user.id,
          category: 'HACCP',
          priority: 'HIGH',
          title: '센서 오프라인 알림',
          body: `${sensorList}${additionalCount} 센서가 오프라인 상태입니다.`,
          deep_link: '/haccp/sensors',
        });
      }
    }

    // Check for sensors with calibration due
    const calibrationDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data: needsCalibration } = await getSupabase()
      .from('iot_sensors')
      .select('*, company:companies(name)')
      .eq('is_active', true)
      .lte('calibration_due_at', calibrationDueDate.toISOString());

    if (needsCalibration && needsCalibration.length > 0) {
      const calibrationByCompany: Record<string, string[]> = {};

      for (const sensor of needsCalibration) {
        if (!calibrationByCompany[sensor.company_id]) {
          calibrationByCompany[sensor.company_id] = [];
        }
        calibrationByCompany[sensor.company_id].push(
          sensor.sensor_name || sensor.id
        );
      }

      for (const [companyId, sensorNames] of Object.entries(calibrationByCompany)) {
        const { data: users } = await getSupabase()
          .from('users')
          .select('id')
          .eq('company_id', companyId)
          .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

        for (const user of users || []) {
          await getSupabase().from('notifications').insert({
            user_id: user.id,
            category: 'HACCP',
            priority: 'NORMAL',
            title: '센서 교정 필요',
            body: `${sensorNames.length}개 센서의 교정이 필요합니다.`,
            deep_link: '/haccp/sensors',
          });
        }
      }
    }

    console.log('[Cron] Sensor health check completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
      needsCalibration: needsCalibration?.length || 0,
    });
  } catch (error) {
    console.error('[Cron] Error in sensor health check:', error);
    return NextResponse.json(
      { error: 'Failed to check sensor health' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
