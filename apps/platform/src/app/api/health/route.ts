/**
 * 플랫폼 헬스 체크 및 시스템 상태 API
 * GET /api/health - 시스템 상태 조회 (public)
 * GET /api/health?detailed=true - 상세 시스템 상태 (super_admin only)
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { subMinutes, subHours } from 'date-fns';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: string;
  services: {
    database: ServiceStatus;
    auth: ServiceStatus;
    storage: ServiceStatus;
    notifications: ServiceStatus;
  };
  metrics?: DetailedMetrics;
}

interface ServiceStatus {
  status: 'up' | 'degraded' | 'down';
  latency?: number;
  message?: string;
}

interface DetailedMetrics {
  database: {
    connections: number;
    queryLatencyMs: number;
    recentErrors: number;
  };
  activeUsers: {
    last5min: number;
    last1hour: number;
    last24hours: number;
  };
  queuedJobs: {
    notifications: number;
    authDeletions: number;
    approvalEscalations: number;
  };
  recentErrors: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';

  try {
    const adminClient = createAdminClient();

    // 기본 헬스 체크
    const dbStart = Date.now();
    const { error: dbError } = await adminClient
      .from('companies')
      .select('id')
      .limit(1);
    const dbLatency = Date.now() - dbStart;

    const databaseStatus: ServiceStatus = {
      status: dbError ? 'down' : dbLatency > 1000 ? 'degraded' : 'up',
      latency: dbLatency,
      message: dbError?.message,
    };

    // Auth 서비스 상태
    const authStart = Date.now();
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.getSession();
    const authLatency = Date.now() - authStart;

    const authStatus: ServiceStatus = {
      status: authError ? 'down' : authLatency > 1000 ? 'degraded' : 'up',
      latency: authLatency,
    };

    // Storage 상태 (추정)
    const storageStatus: ServiceStatus = {
      status: 'up',
      latency: 0,
    };

    // Notifications 상태
    const { count: pendingNotifications } = await adminClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .gte('created_at', subHours(new Date(), 1).toISOString());

    const notificationStatus: ServiceStatus = {
      status: (pendingNotifications || 0) > 10000 ? 'degraded' : 'up',
      message: pendingNotifications ? `${pendingNotifications} pending` : undefined,
    };

    // 전체 상태 결정
    const services = {
      database: databaseStatus,
      auth: authStatus,
      storage: storageStatus,
      notifications: notificationStatus,
    };

    const allUp = Object.values(services).every(s => s.status === 'up');
    const anyDown = Object.values(services).some(s => s.status === 'down');

    const overallStatus: HealthStatus['status'] = anyDown
      ? 'unhealthy'
      : allUp
        ? 'healthy'
        : 'degraded';

    const uptimeMs = Date.now() - startTime;
    const uptimeStr = formatUptime(uptimeMs);

    const healthResponse: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: uptimeStr,
      services,
    };

    // 상세 정보는 super_admin만 조회 가능
    if (detailed) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await adminClient
          .from('users')
          .select('role')
          .eq('auth_id', user.id)
          .single();

        if (profile?.role === 'super_admin') {
          const now = new Date();
          const fiveMinAgo = subMinutes(now, 5);
          const oneHourAgo = subHours(now, 1);
          const twentyFourHoursAgo = subHours(now, 24);

          // 활성 사용자 (로그인 기준)
          const { count: last5min } = await adminClient
            .from('users')
            .select('id', { count: 'exact', head: true })
            .gte('last_login_at', fiveMinAgo.toISOString());

          const { count: last1hour } = await adminClient
            .from('users')
            .select('id', { count: 'exact', head: true })
            .gte('last_login_at', oneHourAgo.toISOString());

          const { count: last24hours } = await adminClient
            .from('users')
            .select('id', { count: 'exact', head: true })
            .gte('last_login_at', twentyFourHoursAgo.toISOString());

          // 대기 중인 작업
          const { count: pendingAuthDeletions } = await adminClient
            .from('pending_auth_deletions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING');

          const { count: pendingApprovals } = await adminClient
            .from('approval_requests')
            .select('id', { count: 'exact', head: true })
            .eq('final_status', 'PENDING');

          healthResponse.metrics = {
            database: {
              connections: 0, // Supabase doesn't expose this directly
              queryLatencyMs: dbLatency,
              recentErrors: dbError ? 1 : 0,
            },
            activeUsers: {
              last5min: last5min || 0,
              last1hour: last1hour || 0,
              last24hours: last24hours || 0,
            },
            queuedJobs: {
              notifications: pendingNotifications || 0,
              authDeletions: pendingAuthDeletions || 0,
              approvalEscalations: pendingApprovals || 0,
            },
            recentErrors: [],
          };
        }
      }
    }

    return NextResponse.json(healthResponse);
  } catch (error) {
    console.error('Health check error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime: formatUptime(Date.now() - startTime),
        services: {
          database: { status: 'down', message: 'Connection failed' },
          auth: { status: 'down' },
          storage: { status: 'down' },
          notifications: { status: 'down' },
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
