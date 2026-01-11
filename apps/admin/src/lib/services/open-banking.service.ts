/**
 * 오픈뱅킹 연동 서비스
 * OAuth 연동 및 거래내역 조회
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface OpenBankingTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: Date;
  tokenType: string;
  userSeqNo: string;
}

export interface BankAccount {
  fintechUseNum: string;
  accountNo: string;
  bankName: string;
  bankCode: string;
  accountAlias: string;
  balance?: number;
}

export interface Transaction {
  tranNo: string;
  tranDate: string;
  tranTime: string;
  inoutType: 'IN' | 'OUT';
  tranType: string;
  tranAmt: number;
  afterBalanceAmt: number;
  printContent: string;
  remark1: string;
  remark2: string;
  remark3: string;
}

export class OpenBankingService {
  private readonly clientId = process.env.OPENBANKING_CLIENT_ID!;
  private readonly clientSecret = process.env.OPENBANKING_CLIENT_SECRET!;
  private readonly redirectUri = process.env.OPENBANKING_REDIRECT_URI!;
  private readonly baseUrl = process.env.OPENBANKING_BASE_URL || 'https://openapi.open-platform.or.kr';

  /**
   * OAuth 인증 URL 생성
   */
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'login inquiry',
      state,
      auth_type: '0', // 0: 간편인증
    });

    return `${this.baseUrl}/oauth/2.0/authorize?${params.toString()}`;
  }

  /**
   * 인증 코드로 토큰 교환
   */
  async exchangeCodeForToken(code: string): Promise<OpenBankingTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const response = await fetch(`${this.baseUrl}/oauth/2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.rsp_message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      userSeqNo: data.user_seq_no,
    };
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(refreshToken: string): Promise<OpenBankingTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(`${this.baseUrl}/oauth/2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.rsp_message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      userSeqNo: data.user_seq_no,
    };
  }

  /**
   * 계좌 목록 조회
   */
  async getAccounts(accessToken: string, userSeqNo: string): Promise<BankAccount[]> {
    const params = new URLSearchParams({
      user_seq_no: userSeqNo,
      include_cancel_yn: 'N',
      sort_order: 'D',
    });

    const response = await fetch(`${this.baseUrl}/v2.0/user/me?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Get accounts failed: ${error.rsp_message || 'Unknown error'}`);
    }

    const data = await response.json();

    return data.res_list.map((account: any) => ({
      fintechUseNum: account.fintech_use_num,
      accountNo: account.account_num_masked,
      bankName: account.bank_name,
      bankCode: account.bank_code_std,
      accountAlias: account.account_alias,
    }));
  }

  /**
   * 거래내역 조회
   */
  async getTransactions(
    accessToken: string,
    fintechUseNum: string,
    fromDate: string,
    toDate: string
  ): Promise<Transaction[]> {
    const tranId = this.generateTranId();

    const params = new URLSearchParams({
      bank_tran_id: tranId,
      fintech_use_num: fintechUseNum,
      inquiry_type: 'A', // A: 전체, I: 입금, O: 출금
      inquiry_base: 'D', // D: 거래일자, T: 거래시간
      from_date: fromDate.replace(/-/g, ''),
      to_date: toDate.replace(/-/g, ''),
      sort_order: 'D', // D: 내림차순
      tran_dtime: this.getCurrentTranDtime(),
    });

    const response = await fetch(
      `${this.baseUrl}/v2.0/account/transaction_list/fin_num?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Get transactions failed: ${error.rsp_message || 'Unknown error'}`);
    }

    const data = await response.json();

    return data.res_list.map((tx: any) => ({
      tranNo: tx.tran_no,
      tranDate: tx.tran_date,
      tranTime: tx.tran_time,
      inoutType: tx.inout_type === '1' ? 'IN' : 'OUT',
      tranType: tx.tran_type,
      tranAmt: parseInt(tx.tran_amt),
      afterBalanceAmt: parseInt(tx.after_balance_amt),
      printContent: tx.print_content,
      remark1: tx.remark1,
      remark2: tx.remark2,
      remark3: tx.remark3,
    }));
  }

  /**
   * 회사별 오픈뱅킹 연결
   */
  async connectToCompany(
    companyId: string,
    code: string
  ): Promise<{ success: boolean; sourceId: string }> {
    try {
      const tokens = await this.exchangeCodeForToken(code);
      const accounts = await this.getAccounts(tokens.accessToken, tokens.userSeqNo);

      // revenue_sources에 저장
      const { data, error } = await supabase
        .from('revenue_sources')
        .insert({
          company_id: companyId,
          source_type: 'OPENBANKING',
          source_name: '오픈뱅킹',
          is_active: true,
          connection_data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt.toISOString(),
            userSeqNo: tokens.userSeqNo,
            accounts,
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      return { success: true, sourceId: data.id };
    } catch (error) {
      console.error('Open Banking connection error:', error);
      throw error;
    }
  }

  /**
   * 거래내역 동기화 및 비용 저장
   */
  async syncTransactions(
    sourceId: string,
    fromDate: string,
    toDate: string
  ): Promise<number> {
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
        ...tokens,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt.toISOString(),
      };

      await supabase
        .from('revenue_sources')
        .update({ connection_data: tokens })
        .eq('id', sourceId);
    }

    let syncedCount = 0;

    // 각 계좌별 거래내역 조회
    for (const account of tokens.accounts || []) {
      try {
        const transactions = await this.getTransactions(
          tokens.accessToken,
          account.fintechUseNum,
          fromDate,
          toDate
        );

        // 출금 거래만 비용으로 저장
        for (const tx of transactions.filter(t => t.inoutType === 'OUT')) {
          const { error } = await supabase.from('expense_transactions').upsert(
            {
              company_id: source.company_id,
              transaction_date: `${tx.tranDate.slice(0, 4)}-${tx.tranDate.slice(4, 6)}-${tx.tranDate.slice(6, 8)}`,
              merchant_name: tx.printContent || tx.remark1,
              amount: tx.tranAmt,
              source: 'OPENBANKING',
            },
            { onConflict: 'company_id,transaction_date,merchant_name,amount' }
          );

          if (!error) syncedCount++;
        }
      } catch (error) {
        console.error(`Sync failed for account ${account.fintechUseNum}:`, error);
      }
    }

    // 마지막 동기화 시간 업데이트
    await supabase
      .from('revenue_sources')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', sourceId);

    return syncedCount;
  }

  private generateTranId(): string {
    const orgCode = process.env.OPENBANKING_ORG_CODE || 'M000000000';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 9; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${orgCode}U${suffix}`;
  }

  private getCurrentTranDtime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
  }
}

export const openBankingService = new OpenBankingService();

export default OpenBankingService;
