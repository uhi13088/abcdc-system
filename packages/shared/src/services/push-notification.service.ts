/**
 * 푸시 알림 서비스
 * Firebase Cloud Messaging (FCM)을 사용한 푸시 알림 발송
 */

import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

export interface PushNotification {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  category?: 'GENERAL' | 'SCHEDULE' | 'SALARY' | 'CONTRACT' | 'APPROVAL' | 'EMERGENCY' | 'HACCP' | 'CHAT';
  priority?: 'HIGH' | 'NORMAL';
  deepLink?: string;
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
  badge?: number;
  sound?: string;
  channelId?: string;
  ttl?: number; // Time to live in seconds
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  failedTokens?: string[];
  error?: string;
}

export interface UserToken {
  userId: string;
  fcmToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  lastUsedAt: Date;
}

// Android Notification Channels
const NOTIFICATION_CHANNELS = {
  GENERAL: 'general_channel',
  SCHEDULE: 'schedule_channel',
  SALARY: 'salary_channel',
  CONTRACT: 'contract_channel',
  APPROVAL: 'approval_channel',
  EMERGENCY: 'emergency_channel',
  HACCP: 'haccp_channel',
  CHAT: 'chat_channel',
};

// Category별 기본 설정
const CATEGORY_DEFAULTS: Record<string, Partial<PushNotification>> = {
  GENERAL: {
    priority: 'NORMAL',
    sound: 'default',
    channelId: NOTIFICATION_CHANNELS.GENERAL,
  },
  SCHEDULE: {
    priority: 'NORMAL',
    sound: 'default',
    channelId: NOTIFICATION_CHANNELS.SCHEDULE,
  },
  SALARY: {
    priority: 'HIGH',
    sound: 'default',
    channelId: NOTIFICATION_CHANNELS.SALARY,
  },
  CONTRACT: {
    priority: 'HIGH',
    sound: 'default',
    channelId: NOTIFICATION_CHANNELS.CONTRACT,
  },
  APPROVAL: {
    priority: 'HIGH',
    sound: 'default',
    channelId: NOTIFICATION_CHANNELS.APPROVAL,
  },
  EMERGENCY: {
    priority: 'HIGH',
    sound: 'emergency',
    channelId: NOTIFICATION_CHANNELS.EMERGENCY,
  },
  HACCP: {
    priority: 'HIGH',
    sound: 'alert',
    channelId: NOTIFICATION_CHANNELS.HACCP,
  },
  CHAT: {
    priority: 'NORMAL',
    sound: 'message',
    channelId: NOTIFICATION_CHANNELS.CHAT,
  },
};

export class PushNotificationService {
  private messaging: admin.messaging.Messaging | null = null;
  private initialized = false;

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

      if (!serviceAccountJson) {
        logger.log('FIREBASE_SERVICE_ACCOUNT is not set. Push notifications will be disabled.');
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

      // Firebase 앱이 이미 초기화되어 있는지 확인
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      this.messaging = admin.messaging();
      this.initialized = true;
      logger.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
    }
  }

  /**
   * FCM 토큰 등록
   */
  async registerToken(
    userId: string,
    fcmToken: string,
    platform: 'ios' | 'android' | 'web',
    deviceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    // 이 메서드는 Supabase에 토큰을 저장하는 로직이 필요
    // 실제 구현 시 데이터베이스 연동 필요
    logger.log('Token registration:', { userId, platform, deviceId });

    return { success: true };
  }

  /**
   * FCM 토큰 삭제
   */
  async unregisterToken(
    userId: string,
    _fcmToken: string
  ): Promise<{ success: boolean; error?: string }> {
    // 토큰 삭제 로직
    logger.log('Token unregistration:', { userId });

    return { success: true };
  }

  /**
   * 단일 사용자에게 푸시 알림 발송
   */
  async send(
    fcmToken: string,
    notification: PushNotification
  ): Promise<PushNotificationResult> {
    if (!this.initialized || !this.messaging) {
      console.warn('Firebase not initialized. Skipping push notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const categoryDefaults = CATEGORY_DEFAULTS[notification.category || 'GENERAL'];
      const mergedNotification = { ...categoryDefaults, ...notification };

      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: mergedNotification.title,
          body: mergedNotification.body,
          imageUrl: mergedNotification.imageUrl,
        },
        data: {
          ...mergedNotification.data,
          deepLink: mergedNotification.deepLink || '',
          category: mergedNotification.category || 'GENERAL',
          actions: JSON.stringify(mergedNotification.actions || []),
        },
        android: {
          priority: mergedNotification.priority === 'HIGH' ? 'high' : 'normal',
          notification: {
            channelId: mergedNotification.channelId || NOTIFICATION_CHANNELS.GENERAL,
            sound: mergedNotification.sound || 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
          ttl: (mergedNotification.ttl || 86400) * 1000, // Convert to milliseconds
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: mergedNotification.title,
                body: mergedNotification.body,
              },
              sound: mergedNotification.sound || 'default',
              badge: mergedNotification.badge,
              category: mergedNotification.category,
            },
          },
        },
        webpush: {
          notification: {
            title: mergedNotification.title,
            body: mergedNotification.body,
            icon: '/icons/notification-icon.png',
            badge: '/icons/notification-badge.png',
            actions: mergedNotification.actions?.map(action => ({
              action: action.id,
              title: action.title,
              icon: action.icon,
            })),
          },
          fcmOptions: {
            link: mergedNotification.deepLink,
          },
        },
      };

      const messageId = await this.messaging.send(message);

      return { success: true, messageId };
    } catch (error) {
      console.error('Push notification send error:', error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorCode = (error as any).code;

      // 유효하지 않은 토큰 처리
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        return {
          success: false,
          error: 'Invalid token',
          failedTokens: [fcmToken],
        };
      }

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 여러 사용자에게 푸시 알림 발송
   */
  async sendToMultiple(
    fcmTokens: string[],
    notification: PushNotification
  ): Promise<PushNotificationResult> {
    if (!this.initialized || !this.messaging) {
      console.warn('Firebase not initialized. Skipping push notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (fcmTokens.length === 0) {
      return { success: true, messageId: 'no_tokens' };
    }

    try {
      const categoryDefaults = CATEGORY_DEFAULTS[notification.category || 'GENERAL'];
      const mergedNotification = { ...categoryDefaults, ...notification };

      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title: mergedNotification.title,
          body: mergedNotification.body,
          imageUrl: mergedNotification.imageUrl,
        },
        data: {
          ...mergedNotification.data,
          deepLink: mergedNotification.deepLink || '',
          category: mergedNotification.category || 'GENERAL',
          actions: JSON.stringify(mergedNotification.actions || []),
        },
        android: {
          priority: mergedNotification.priority === 'HIGH' ? 'high' : 'normal',
          notification: {
            channelId: mergedNotification.channelId || NOTIFICATION_CHANNELS.GENERAL,
            sound: mergedNotification.sound || 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: mergedNotification.title,
                body: mergedNotification.body,
              },
              sound: mergedNotification.sound || 'default',
              badge: mergedNotification.badge,
            },
          },
        },
      };

      const response = await this.messaging.sendEachForMulticast(message);

      // 실패한 토큰 수집
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(fcmTokens[idx]);
          }
        }
      });

      return {
        success: response.successCount > 0,
        messageId: `batch_${response.successCount}/${fcmTokens.length}`,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      };
    } catch (error) {
      console.error('Multicast push notification error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 토픽으로 푸시 알림 발송
   */
  async sendToTopic(
    topic: string,
    notification: PushNotification
  ): Promise<PushNotificationResult> {
    if (!this.initialized || !this.messaging) {
      console.warn('Firebase not initialized. Skipping push notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const categoryDefaults = CATEGORY_DEFAULTS[notification.category || 'GENERAL'];
      const mergedNotification = { ...categoryDefaults, ...notification };

      const message: admin.messaging.Message = {
        topic: topic,
        notification: {
          title: mergedNotification.title,
          body: mergedNotification.body,
          imageUrl: mergedNotification.imageUrl,
        },
        data: {
          ...mergedNotification.data,
          deepLink: mergedNotification.deepLink || '',
          category: mergedNotification.category || 'GENERAL',
        },
      };

      const messageId = await this.messaging.send(message);

      return { success: true, messageId };
    } catch (error) {
      console.error('Topic push notification error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 토픽 구독
   */
  async subscribeToTopic(
    fcmTokens: string[],
    topic: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.initialized || !this.messaging) {
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      await this.messaging.subscribeToTopic(fcmTokens, topic);
      return { success: true };
    } catch (error) {
      console.error('Topic subscription error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 토픽 구독 해제
   */
  async unsubscribeFromTopic(
    fcmTokens: string[],
    topic: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.initialized || !this.messaging) {
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      await this.messaging.unsubscribeFromTopic(fcmTokens, topic);
      return { success: true };
    } catch (error) {
      console.error('Topic unsubscription error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // ===== 편의 메서드들 =====

  /**
   * 스케줄 알림 발송
   */
  async sendScheduleNotification(
    fcmToken: string,
    data: {
      staffName: string;
      workDate: string;
      startTime: string;
      endTime: string;
      storeName: string;
    }
  ): Promise<PushNotificationResult> {
    return this.send(fcmToken, {
      title: '내일 근무 일정',
      body: `${data.workDate} ${data.startTime}~${data.endTime} (${data.storeName})`,
      category: 'SCHEDULE',
      deepLink: '/schedule',
      data: {
        workDate: data.workDate,
        storeName: data.storeName,
      },
    });
  }

  /**
   * 급여 알림 발송
   */
  async sendSalaryNotification(
    fcmToken: string,
    data: {
      year: number;
      month: number;
      netPay: number;
      salaryId: string;
    }
  ): Promise<PushNotificationResult> {
    return this.send(fcmToken, {
      title: `${data.year}년 ${data.month}월 급여 확정`,
      body: `실수령액: ${data.netPay.toLocaleString('ko-KR')}원`,
      category: 'SALARY',
      deepLink: `/salary/${data.salaryId}`,
      data: {
        salaryId: data.salaryId,
        year: String(data.year),
        month: String(data.month),
      },
    });
  }

  /**
   * 계약서 서명 요청 알림 발송
   */
  async sendContractSignatureRequest(
    fcmToken: string,
    data: {
      contractId: string;
      companyName: string;
    }
  ): Promise<PushNotificationResult> {
    return this.send(fcmToken, {
      title: '계약서 서명 요청',
      body: `${data.companyName}에서 근로계약서를 발송했습니다. 확인 후 서명해주세요.`,
      category: 'CONTRACT',
      deepLink: `/contracts/${data.contractId}/sign`,
      actions: [
        { id: 'VIEW', title: '확인하기' },
        { id: 'LATER', title: '나중에' },
      ],
      data: {
        contractId: data.contractId,
      },
    });
  }

  /**
   * 승인 요청 알림 발송
   */
  async sendApprovalRequest(
    fcmToken: string,
    data: {
      approvalId: string;
      approvalType: string;
      requesterName: string;
      description: string;
    }
  ): Promise<PushNotificationResult> {
    return this.send(fcmToken, {
      title: `${data.approvalType} 승인 요청`,
      body: `${data.requesterName}님이 ${data.description}`,
      category: 'APPROVAL',
      deepLink: `/approvals/${data.approvalId}`,
      actions: [
        { id: 'APPROVE', title: '승인' },
        { id: 'REJECT', title: '반려' },
        { id: 'VIEW', title: '상세보기' },
      ],
      data: {
        approvalId: data.approvalId,
        approvalType: data.approvalType,
      },
    });
  }

  /**
   * 긴급 근무 모집 알림 발송
   */
  async sendEmergencyShiftNotification(
    fcmTokens: string[],
    data: {
      shiftId: string;
      storeName: string;
      date: string;
      startTime: string;
      endTime: string;
      hourlyRate: number;
      bonus?: number;
    }
  ): Promise<PushNotificationResult> {
    const bonusText = data.bonus ? ` (+${data.bonus.toLocaleString('ko-KR')}원 추가수당)` : '';

    return this.sendToMultiple(fcmTokens, {
      title: '긴급! 근무자 모집',
      body: `${data.storeName} ${data.date} ${data.startTime}~${data.endTime} / 시급 ${data.hourlyRate.toLocaleString('ko-KR')}원${bonusText}`,
      category: 'EMERGENCY',
      deepLink: `/emergency-shifts/${data.shiftId}`,
      actions: [
        { id: 'APPLY', title: '신청하기' },
        { id: 'VIEW', title: '상세보기' },
      ],
      data: {
        shiftId: data.shiftId,
        storeName: data.storeName,
      },
    });
  }

  /**
   * HACCP 경고 알림 발송
   */
  async sendHaccpAlert(
    fcmTokens: string[],
    data: {
      alertType: 'TEMPERATURE' | 'CHECKLIST' | 'DEVIATION';
      location: string;
      message: string;
      severity: 'WARNING' | 'CRITICAL';
    }
  ): Promise<PushNotificationResult> {
    return this.sendToMultiple(fcmTokens, {
      title: data.severity === 'CRITICAL' ? '긴급 HACCP 경고' : 'HACCP 주의',
      body: `[${data.location}] ${data.message}`,
      category: 'HACCP',
      priority: 'HIGH',
      deepLink: '/haccp/alerts',
      data: {
        alertType: data.alertType,
        location: data.location,
        severity: data.severity,
      },
    });
  }

  /**
   * 채팅 메시지 알림 발송
   */
  async sendChatNotification(
    fcmToken: string,
    data: {
      chatRoomId: string;
      senderName: string;
      message: string;
      senderAvatar?: string;
    }
  ): Promise<PushNotificationResult> {
    return this.send(fcmToken, {
      title: data.senderName,
      body: data.message,
      imageUrl: data.senderAvatar,
      category: 'CHAT',
      deepLink: `/chat/${data.chatRoomId}`,
      data: {
        chatRoomId: data.chatRoomId,
        senderName: data.senderName,
      },
    });
  }
}

// Lazy-loaded 싱글톤 인스턴스
let _pushNotificationService: PushNotificationService | null = null;

export function getPushNotificationService(): PushNotificationService {
  if (!_pushNotificationService) {
    _pushNotificationService = new PushNotificationService();
  }
  return _pushNotificationService;
}

// 하위 호환성을 위한 프록시 (pushNotificationService를 직접 사용하는 코드 지원)
export const pushNotificationService = new Proxy({} as PushNotificationService, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getPushNotificationService() as any)[prop];
  }
});

export default PushNotificationService;
