/**
 * 토스 POS 매출 자동 동기화 Cron Job
 * 매시간 실행하여 연결된 모든 토스 POS 데이터 동기화
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import { tossPOSService } from '@/lib/services/toss-pos.service';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseClient();
  try {
    console.log('[Cron] Starting Toss POS sync...');

    // 활성화된 토스 POS 소스 조회
    const { data: sources, error: sourcesError } = await supabase
      .from('revenue_sources')
      .select('*')
      .eq('source_type', 'TOSS_POS')
      .eq('is_active', true);

    if (sourcesError) {
      console.error('[Cron] Error fetching sources:', sourcesError);
      return NextResponse.json({ error: sourcesError.message }, { status: 500 });
    }

    if (!sources || sources.length === 0) {
      console.log('[Cron] No active Toss POS sources found');
      return NextResponse.json({
        success: true,
        message: 'No sources to sync',
        synced: 0,
      });
    }

    console.log(`[Cron] Found ${sources.length} sources to sync`);

    const results: { sourceId: string; success: boolean; syncedDays?: number; error?: string }[] = [];

    // 동기화 기간: 어제~오늘
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');

    for (const source of sources) {
      try {
        console.log(`[Cron] Syncing source ${source.id} for company ${source.company_id}`);

        const tokens = source.connection_data;

        // 토큰 만료 확인 및 갱신
        if (new Date(tokens.expiresAt) < new Date()) {
          console.log(`[Cron] Refreshing token for source ${source.id}`);
          const newTokens = await tossPOSService.refreshToken(tokens.refreshToken);

          await supabase
            .from('revenue_sources')
            .update({
              connection_data: {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresAt: newTokens.expiresAt.toISOString(),
              },
            })
            .eq('id', source.id);

          tokens.accessToken = newTokens.accessToken;
        }

        // 매출 데이터 조회
        const sales = await tossPOSService.fetchSales(
          tokens.accessToken,
          yesterday,
          today
        );

        // 일별로 저장
        let syncedDays = 0;
        for (const daySales of sales.daily) {
          const { error } = await supabase.from('daily_sales').upsert(
            {
              company_id: source.company_id,
              revenue_source_id: source.id,
              sales_date: daySales.date,
              total_amount: daySales.totalAmount,
              card_amount: daySales.cardAmount,
              cash_amount: daySales.cashAmount,
              transaction_count: daySales.transactionCount,
              hourly_breakdown: daySales.hourly,
            },
            { onConflict: 'company_id,revenue_source_id,sales_date' }
          );

          if (!error) syncedDays++;
        }

        // 마지막 동기화 시간 업데이트
        await supabase
          .from('revenue_sources')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', source.id);

        results.push({
          sourceId: source.id,
          success: true,
          syncedDays,
        });

        console.log(`[Cron] Successfully synced ${syncedDays} days for source ${source.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Cron] Error syncing source ${source.id}:`, errorMessage);

        results.push({
          sourceId: source.id,
          success: false,
          error: errorMessage,
        });

        // 연속 실패시 소스 비활성화 고려
        const { data: failureLogs } = await supabase
          .from('sync_logs')
          .select('id')
          .eq('source_id', source.id)
          .eq('success', false)
          .gte('created_at', format(subDays(new Date(), 3), 'yyyy-MM-dd'))
          .limit(5);

        if (failureLogs && failureLogs.length >= 5) {
          console.log(`[Cron] Disabling source ${source.id} due to repeated failures`);
          await supabase
            .from('revenue_sources')
            .update({ is_active: false })
            .eq('id', source.id);
        }
      }

      // 동기화 로그 저장
      await supabase.from('sync_logs').insert({
        source_id: source.id,
        source_type: 'TOSS_POS',
        success: results[results.length - 1].success,
        synced_count: results[results.length - 1].syncedDays || 0,
        error_message: results[results.length - 1].error,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Cron] Toss POS sync completed: ${successCount} success, ${failureCount} failures`);

    return NextResponse.json({
      success: true,
      totalSources: sources.length,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error('[Cron] Toss POS sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
