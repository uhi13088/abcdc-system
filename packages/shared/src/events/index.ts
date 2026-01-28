/**
 * Events Module - 이벤트 기반 아키텍처
 *
 * 사용 방법:
 * ```typescript
 * import { EventBus, EventType } from '@abc/shared/events';
 *
 * // 이벤트 발행
 * await EventBus.publish(EventType.SUBSCRIPTION_CREATED, {
 *   company_id: '...',
 *   plan_id: '...',
 *   plan_name: 'Pro',
 * });
 * ```
 */

export { EventBus, EventType } from './event-bus';
export type { EventPayload } from './event-bus';
