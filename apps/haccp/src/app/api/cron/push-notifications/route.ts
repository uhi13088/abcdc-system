import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialize Firebase if not already done
function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      console.log('FIREBASE_SERVICE_ACCOUNT not set');
      return null;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      return null;
    }
  }
  return admin.messaging();
}

// GET /api/cron/push-notifications - Process pending push notifications
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messaging = initFirebase();
    if (!messaging) {
      return NextResponse.json({ message: 'Firebase not configured, skipping' });
    }

    const adminClient = createAdminClient();

    // Get pending notifications (limit to 100 per run)
    const { data: pendingQueue, error: fetchError } = await adminClient
      .from('push_notification_queue')
      .select('*')
      .eq('status', 'PENDING')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('[Push Cron] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingQueue || pendingQueue.length === 0) {
      return NextResponse.json({ message: 'No pending notifications', processed: 0 });
    }

    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const item of pendingQueue) {
      try {
        // Mark as processing
        await adminClient
          .from('push_notification_queue')
          .update({
            status: 'PROCESSING',
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        const payload = item.payload as {
          title: string;
          body: string;
          category?: string;
          priority?: string;
          data?: Record<string, string>;
          deepLink?: string;
        };

        const fcmTokens = item.fcm_tokens as string[];

        if (fcmTokens.length === 0) {
          await adminClient
            .from('push_notification_queue')
            .update({
              status: 'SENT',
              success_count: 0,
              failure_count: 0,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          continue;
        }

        // Prepare message
        const message: admin.messaging.MulticastMessage = {
          tokens: fcmTokens,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            ...(payload.data || {}),
            deepLink: payload.deepLink || '',
            category: payload.category || 'GENERAL',
          },
          android: {
            priority: payload.priority === 'HIGH' ? 'high' : 'normal',
            notification: {
              channelId: 'haccp_channel',
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: payload.title,
                  body: payload.body,
                },
                sound: 'default',
                category: payload.category,
              },
            },
          },
        };

        // Send
        const response = await messaging.sendEachForMulticast(message);

        // Collect failed tokens
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

        // Mark invalid tokens as inactive
        if (failedTokens.length > 0) {
          await adminClient
            .from('user_fcm_tokens')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in('fcm_token', failedTokens);
        }

        // Update queue item
        const finalStatus =
          response.successCount === fcmTokens.length
            ? 'SENT'
            : response.successCount > 0
              ? 'PARTIAL'
              : 'FAILED';

        await adminClient
          .from('push_notification_queue')
          .update({
            status: finalStatus,
            success_count: response.successCount,
            failure_count: response.failureCount,
            failed_tokens: failedTokens.length > 0 ? failedTokens : null,
            processed_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        processedCount++;
        if (response.successCount > 0) successCount++;
        if (response.failureCount > 0) failureCount++;
      } catch (itemError) {
        console.error(`[Push Cron] Error processing item ${item.id}:`, itemError);

        // Mark as failed if max attempts reached
        const newStatus = item.attempts + 1 >= 3 ? 'FAILED' : 'PENDING';
        await adminClient
          .from('push_notification_queue')
          .update({
            status: newStatus,
            error_message: (itemError as Error).message,
          })
          .eq('id', item.id);

        failureCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      successCount,
      failureCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Push Cron] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
