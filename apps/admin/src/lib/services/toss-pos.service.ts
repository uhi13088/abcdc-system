/**
 * 토스 POS 연동 서비스
 * OAuth 연동 및 매출 데이터 동기화
 */

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

// Lazy-loaded supabase client accessor
const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  }
});

export interface TossTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: Date;
  tokenType: string;
}

export interface TossSalesData {
  date: string;
  totalAmount: number;
  cardAmount: number;
  cashAmount: number;
  transactionCount: number;
  hourly: {
    hour: number;
    amount: number;
    count: number;
  }[];
}

export interface TossDailySales {
  daily: TossSalesData[];
  summary: {
    totalAmount: number;
    cardAmount: number;
    cashAmount: number;
    transactionCount: number;
  };
}

export class TossPOSService {
  private readonly clientId = process.env.TOSS_CLIENT_ID!;
  private readonly clientSecret = process.env.TOSS_CLIENT_SECRET!;
  private readonly redirectUri = process.env.TOSS_REDIRECT_URI!;
  private readonly baseUrl = 'https://api.tosspayments.com';

  /**
   * OAuth 인증 URL 생성
   */
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'pos.sales.read pos.transactions.read',
      state,
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * 인증 코드로 토큰 교환
   */
  async exchangeCodeForToken(code: string): Promise<TossTokens> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(refreshToken: string): Promise<TossTokens> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  /**
   * 매출 데이터 조회
   */
  async fetchSales(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<TossDailySales> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await fetch(`${this.baseUrl}/v1/pos/sales?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Fetch sales failed: ${error.message || 'Unknown error'}`);
    }

    return response.json();
  }

  /**
   * 회사별 토스 POS 연결
   */
  async connectToCompany(
    companyId: string,
    code: string
  ): Promise<{ success: boolean; sourceId: string }> {
    try {
      const tokens = await this.exchangeCodeForToken(code);

      // revenue_sources에 저장
      const { data, error } = await supabase
        .from('revenue_sources')
        .insert({
          company_id: companyId,
          source_type: 'TOSS_POS',
          source_name: '토스 POS',
          is_active: true,
          connection_data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt.toISOString(),
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      return { success: true, sourceId: data.id };
    } catch (error) {
      console.error('Toss POS connection error:', error);
      throw error;
    }
  }

  /**
   * 토스 POS 연결 해제
   */
  async disconnectFromCompany(companyId: string): Promise<void> {
    await supabase
      .from('revenue_sources')
      .update({ is_active: false })
      .eq('company_id', companyId)
      .eq('source_type', 'TOSS_POS');
  }

  /**
   * 매출 데이터 동기화
   */
  async syncSales(sourceId: string, startDate: string, endDate: string): Promise<number> {
    // 소스 정보 조회
    const { data: source, error: sourceError } = await supabase
      .from('revenue_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      throw new Error('Revenue source not found');
    }

    let tokens = source.connection_data;

    // 토큰 만료 확인 및 갱신
    if (new Date(tokens.expiresAt) < new Date()) {
      const newTokens = await this.refreshToken(tokens.refreshToken);
      tokens = {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt.toISOString(),
      };

      // 새 토큰 저장
      await supabase
        .from('revenue_sources')
        .update({ connection_data: tokens })
        .eq('id', sourceId);
    }

    // 매출 데이터 조회
    const sales = await this.fetchSales(tokens.accessToken, startDate, endDate);

    // daily_sales에 저장
    let syncedCount = 0;
    for (const daySales of sales.daily) {
      const { error } = await supabase.from('daily_sales').upsert(
        {
          company_id: source.company_id,
          revenue_source_id: sourceId,
          sales_date: daySales.date,
          total_amount: daySales.totalAmount,
          card_amount: daySales.cardAmount,
          cash_amount: daySales.cashAmount,
          transaction_count: daySales.transactionCount,
          hourly_breakdown: daySales.hourly,
        },
        { onConflict: 'company_id,revenue_source_id,sales_date' }
      );

      if (!error) syncedCount++;
    }

    // 마지막 동기화 시간 업데이트
    await supabase
      .from('revenue_sources')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', sourceId);

    return syncedCount;
  }

  /**
   * 회사의 토스 POS 연결 상태 확인
   */
  async getConnectionStatus(companyId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: string;
    sourceId?: string;
  }> {
    const { data } = await supabase
      .from('revenue_sources')
      .select('id, last_synced_at')
      .eq('company_id', companyId)
      .eq('source_type', 'TOSS_POS')
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      return { connected: false };
    }

    return {
      connected: true,
      lastSyncedAt: data.last_synced_at,
      sourceId: data.id,
    };
  }
}

export const tossPOSService = new TossPOSService();

export default TossPOSService;
