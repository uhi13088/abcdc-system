/**
 * Event Bus - 이벤트 기반 아키텍처 핵심 모듈
 *
 * 사용 예시:
 * ```typescript
 * import { EventBus, EventType } from '@abc/shared/events';
 *
 * // 이벤트 발행
 * await EventBus.publish(EventType.SUBSCRIPTION_CREATED, {
 *   company_id: '...',
 *   plan_id: '...',
 * });
 *
 * // 이벤트 처리 (API Route에서)
 * await EventBus.handleEvent(eventType, payload);
 * ```
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Event Types
export enum EventType {
  // Subscription Events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPGRADED = 'subscription.upgraded',
  SUBSCRIPTION_DOWNGRADED = 'subscription.downgraded',
  SUBSCRIPTION_EXPIRING = 'subscription.expiring',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',

  // Payment Events
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',

  // User Events
  USER_CREATED = 'user.created',
  USER_INVITED = 'user.invited',
  USER_ACTIVATED = 'user.activated',
  USER_DEACTIVATED = 'user.deactivated',
  USER_INACTIVE_WARNING = 'user.inactive_warning',

  // Usage Events
  USAGE_LIMIT_WARNING = 'usage.limit_warning',
  USAGE_LIMIT_EXCEEDED = 'usage.limit_exceeded',

  // IoT Events
  SENSOR_OFFLINE = 'sensor.offline',
  SENSOR_ONLINE = 'sensor.online',
  SENSOR_ALERT = 'sensor.alert',
  DEVICE_REGISTERED = 'device.registered',

  // HACCP Events
  CCP_DEVIATION = 'ccp.deviation',
  CCP_CORRECTIVE_ACTION = 'ccp.corrective_action',

  // Legal Events
  LABOR_LAW_UPDATED = 'labor_law.updated',
  LABOR_LAW_APPLIED = 'labor_law.applied',

  // Report Events
  WEEKLY_REPORT_GENERATED = 'report.weekly_generated',
  MONTHLY_REPORT_GENERATED = 'report.monthly_generated',
}

// Event Payload Types
export interface EventPayload {
  event_type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: {
    source?: string;
    user_id?: string;
    company_id?: string;
    correlation_id?: string;
  };
}

// Event Handlers Registry
type EventHandler = (payload: EventPayload) => Promise<void>;
const handlers: Map<EventType, EventHandler[]> = new Map();

// Supabase Client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return supabaseClient;
}

export const EventBus = {
  /**
   * 이벤트 발행
   */
  async publish(
    eventType: EventType,
    data: Record<string, unknown>,
    metadata?: EventPayload['metadata']
  ): Promise<void> {
    const payload: EventPayload = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      data,
      metadata,
    };

    // Log event to database for audit trail
    try {
      await getSupabase()
        .from('system_events')
        .insert({
          event_type: eventType,
          payload: payload,
          created_at: payload.timestamp,
        });
    } catch (error) {
      console.error('[EventBus] Failed to log event:', error);
      // Continue even if logging fails
    }

    // Execute registered handlers
    const eventHandlers = handlers.get(eventType) || [];
    for (const handler of eventHandlers) {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${eventType}:`, error);
      }
    }

    // Execute default handlers based on event type
    await this.executeDefaultHandlers(payload);
  },

  /**
   * 이벤트 핸들러 등록
   */
  subscribe(eventType: EventType, handler: EventHandler): void {
    const existing = handlers.get(eventType) || [];
    handlers.set(eventType, [...existing, handler]);
  },

  /**
   * 이벤트 핸들러 해제
   */
  unsubscribe(eventType: EventType, handler: EventHandler): void {
    const existing = handlers.get(eventType) || [];
    handlers.set(
      eventType,
      existing.filter((h) => h !== handler)
    );
  },

  /**
   * 기본 핸들러 실행 (알림, 이메일 등)
   */
  async executeDefaultHandlers(payload: EventPayload): Promise<void> {
    const { event_type, data, metadata } = payload;
    const supabase = getSupabase();

    switch (event_type) {
      // Subscription Events
      case EventType.SUBSCRIPTION_CREATED:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'BILLING',
          'NORMAL',
          '구독이 시작되었습니다',
          `${data.plan_name || '유료'} 플랜 구독이 시작되었습니다.`,
          '/settings/subscription'
        );
        break;

      case EventType.SUBSCRIPTION_EXPIRED:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'BILLING',
          'HIGH',
          '구독이 만료되었습니다',
          '구독이 만료되어 무료 플랜으로 변경되었습니다. 서비스 이용에 제한이 있을 수 있습니다.',
          '/settings/subscription'
        );
        // TODO: Send email notification
        break;

      case EventType.SUBSCRIPTION_EXPIRING:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'BILLING',
          'NORMAL',
          '구독 갱신 예정',
          `구독이 ${data.days_remaining || 7}일 후 갱신됩니다. 결제 수단을 확인해주세요.`,
          '/settings/subscription'
        );
        break;

      // Payment Events
      case EventType.PAYMENT_FAILED:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'BILLING',
          'CRITICAL',
          '결제 실패',
          `결제에 실패했습니다. 결제 수단을 확인해주세요. (${data.error_message || ''})`,
          '/settings/billing'
        );
        break;

      // User Events
      case EventType.USER_INVITED:
        // 초대받은 사용자에게 알림 (이메일로 처리됨)
        break;

      case EventType.USER_INACTIVE_WARNING:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'SYSTEM',
          'NORMAL',
          '비활성 직원 알림',
          `${data.user_name || '직원'}님이 30일 이상 접속하지 않았습니다.`,
          '/employees'
        );
        break;

      // Usage Events
      case EventType.USAGE_LIMIT_WARNING:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'USAGE',
          'HIGH',
          '사용량 한도 경고',
          `${data.resource_type || '리소스'} 사용량이 90%를 초과했습니다. (${data.current}/${data.limit})`,
          '/settings/subscription'
        );
        break;

      case EventType.USAGE_LIMIT_EXCEEDED:
        await this.sendNotificationToCompanyAdmins(
          data.company_id as string,
          'USAGE',
          'CRITICAL',
          '사용량 한도 초과',
          `${data.resource_type || '리소스'} 사용량이 한도를 초과했습니다. 플랜 업그레이드가 필요합니다.`,
          '/settings/subscription'
        );
        break;

      // IoT Events
      case EventType.SENSOR_OFFLINE:
        await this.sendNotificationToCompanyUsers(
          data.company_id as string,
          ['HACCP_MANAGER', 'COMPANY_ADMIN'],
          'HACCP',
          'HIGH',
          '센서 오프라인 알림',
          `${data.sensor_name || '센서'}가 오프라인 상태입니다.`,
          '/haccp/sensors'
        );
        break;

      case EventType.SENSOR_ALERT:
        await this.sendNotificationToCompanyUsers(
          data.company_id as string,
          ['HACCP_MANAGER', 'COMPANY_ADMIN'],
          'HACCP',
          'CRITICAL',
          '센서 경고',
          `${data.sensor_name || '센서'}에서 이상이 감지되었습니다: ${data.message || ''}`,
          '/haccp/sensors'
        );
        break;

      // HACCP Events
      case EventType.CCP_DEVIATION:
        await this.sendNotificationToCompanyUsers(
          data.company_id as string,
          ['HACCP_MANAGER', 'COMPANY_ADMIN'],
          'HACCP',
          'CRITICAL',
          'CCP 이탈 발생',
          `${data.ccp_name || 'CCP'}에서 한계기준 이탈이 발생했습니다. 즉시 조치가 필요합니다.`,
          '/haccp/corrective-actions'
        );
        break;

      // Legal Events
      case EventType.LABOR_LAW_UPDATED:
        // labor-law-apply cron에서 처리
        break;

      default:
        // Unknown event type - just log
        console.log(`[EventBus] Unhandled event type: ${event_type}`);
    }
  },

  /**
   * 회사 관리자에게 알림 발송
   */
  async sendNotificationToCompanyAdmins(
    companyId: string,
    category: string,
    priority: string,
    title: string,
    body: string,
    deepLink: string
  ): Promise<void> {
    const supabase = getSupabase();

    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['COMPANY_ADMIN', 'company_admin']);

    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        category,
        priority,
        title,
        body,
        deep_link: deepLink,
      });
    }
  },

  /**
   * 특정 역할의 회사 사용자에게 알림 발송
   */
  async sendNotificationToCompanyUsers(
    companyId: string,
    roles: string[],
    category: string,
    priority: string,
    title: string,
    body: string,
    deepLink: string
  ): Promise<void> {
    const supabase = getSupabase();

    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .in('role', roles);

    for (const user of users || []) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        category,
        priority,
        title,
        body,
        deep_link: deepLink,
      });
    }
  },
};

export default EventBus;
