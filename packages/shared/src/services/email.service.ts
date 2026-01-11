/**
 * 이메일 서비스
 * Resend API를 사용한 이메일 발송
 */

import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: Array<{
    name: string;
    value: string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  variables?: Record<string, string>;
}

// 이메일 템플릿
const EMAIL_TEMPLATES = {
  CONTRACT_SIGNATURE_REQUEST: {
    name: '계약서 서명 요청',
    subject: '[ABC Staff] 근로계약서 서명 요청',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>근로계약서 서명 요청</h1>
          </div>
          <div class="content">
            <p>안녕하세요, {{staffName}}님</p>
            <p>{{companyName}}에서 근로계약서 서명을 요청하였습니다.</p>
            <p>아래 버튼을 클릭하여 계약서를 확인하고 서명해주세요.</p>
            <a href="{{signUrl}}" class="button">계약서 확인 및 서명하기</a>
            <p>본 링크는 {{expiryDate}}까지 유효합니다.</p>
            <p>문의사항이 있으시면 담당자에게 연락해주세요.</p>
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  PAYSLIP: {
    name: '급여명세서 발송',
    subject: '[ABC Staff] {{year}}년 {{month}}월 급여명세서',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .summary { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .amount { font-size: 24px; color: #10b981; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>급여명세서</h1>
          </div>
          <div class="content">
            <p>안녕하세요, {{staffName}}님</p>
            <p>{{year}}년 {{month}}월 급여명세서가 도착하였습니다.</p>
            <div class="summary">
              <p>총 지급액: {{grossPay}}원</p>
              <p>총 공제액: {{totalDeductions}}원</p>
              <p class="amount">실수령액: {{netPay}}원</p>
            </div>
            <p>상세 내역은 첨부된 PDF 파일을 확인해주세요.</p>
            <p>급여 관련 문의사항이 있으시면 담당자에게 연락해주세요.</p>
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  TAX_REPORT: {
    name: '세무 보고서 발송',
    subject: '[ABC Staff] {{year}}년 {{month}}월 급여대장',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>급여대장 보고서</h1>
          </div>
          <div class="content">
            <p>안녕하세요,</p>
            <p>{{companyName}}의 {{year}}년 {{month}}월 급여대장을 전송해드립니다.</p>
            <div class="info">
              <p>총 직원수: {{employeeCount}}명</p>
              <p>총 급여액: {{totalPayroll}}원</p>
              <p>총 4대보험: {{totalInsurance}}원</p>
              <p>총 세금: {{totalTax}}원</p>
            </div>
            <p>상세 내역은 첨부된 Excel 파일을 확인해주세요.</p>
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  SCHEDULE_NOTIFICATION: {
    name: '스케줄 알림',
    subject: '[ABC Staff] 내일 근무 일정 안내',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .schedule { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>내일 근무 일정 안내</h1>
          </div>
          <div class="content">
            <p>안녕하세요, {{staffName}}님</p>
            <p>내일({{workDate}}) 근무 일정을 안내해드립니다.</p>
            <div class="schedule">
              <p><strong>근무지:</strong> {{storeName}}</p>
              <p><strong>근무시간:</strong> {{startTime}} ~ {{endTime}}</p>
              <p><strong>직책/포지션:</strong> {{position}}</p>
            </div>
            <p>시간에 맞춰 출근해주세요.</p>
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  APPROVAL_REQUEST: {
    name: '승인 요청',
    subject: '[ABC Staff] {{approvalType}} 승인 요청',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .button.reject { background: #ef4444; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>{{approvalType}} 승인 요청</h1>
          </div>
          <div class="content">
            <p>안녕하세요,</p>
            <p>{{requesterName}}님이 {{approvalType}} 승인을 요청하였습니다.</p>
            <div class="details">
              <p><strong>요청자:</strong> {{requesterName}} ({{requesterRole}})</p>
              <p><strong>요청일:</strong> {{requestDate}}</p>
              <p><strong>내용:</strong> {{description}}</p>
            </div>
            <div style="text-align: center;">
              <a href="{{approveUrl}}" class="button">승인</a>
              <a href="{{rejectUrl}}" class="button reject">반려</a>
            </div>
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  EMERGENCY_SHIFT: {
    name: '긴급 근무 모집',
    subject: '[ABC Staff] 긴급! {{date}} 근무자 모집',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>긴급 근무자 모집</h1>
          </div>
          <div class="content">
            <p>안녕하세요, {{staffName}}님</p>
            <p>{{storeName}}에서 긴급 근무자를 모집합니다.</p>
            <div class="info">
              <p><strong>날짜:</strong> {{date}}</p>
              <p><strong>시간:</strong> {{startTime}} ~ {{endTime}}</p>
              <p><strong>시급:</strong> {{hourlyRate}}원</p>
              <p><strong>추가수당:</strong> {{bonus}}원</p>
              <p><strong>사유:</strong> {{reason}}</p>
            </div>
            <div style="text-align: center;">
              <a href="{{applyUrl}}" class="button">신청하기</a>
            </div>
            <p>마감: {{deadline}}</p>
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
};

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY is not set. Email sending will be disabled.');
    }
    this.resend = new Resend(apiKey || '');
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@abcstaff.app';
    this.fromName = process.env.EMAIL_FROM_NAME || 'ABC Staff';
  }

  /**
   * 템플릿 변수 치환
   */
  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * 기본 이메일 발송
   */
  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const emailPayload: Parameters<typeof this.resend.emails.send>[0] = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html || '',
        text: options.text,
        attachments: options.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
        })),
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        tags: options.tags,
      };
      const { data, error } = await this.resend.emails.send(emailPayload);

      if (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Email send exception:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 계약서 서명 요청 이메일 발송
   */
  async sendContractForSignature(
    to: string,
    contractId: string,
    variables: {
      staffName: string;
      companyName: string;
      expiryDate: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = EMAIL_TEMPLATES.CONTRACT_SIGNATURE_REQUEST;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.abcstaff.kr';

    const html = this.replaceVariables(template.html, {
      ...variables,
      signUrl: `${baseUrl}/contracts/${contractId}/sign`,
    });

    return this.send({
      to,
      subject: template.subject,
      html,
    });
  }

  /**
   * 급여명세서 이메일 발송
   */
  async sendPayslip(
    to: string,
    payslipPdf: Buffer,
    variables: {
      staffName: string;
      year: string;
      month: string;
      grossPay: string;
      totalDeductions: string;
      netPay: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = EMAIL_TEMPLATES.PAYSLIP;

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html, variables);

    return this.send({
      to,
      subject,
      html,
      attachments: [
        {
          filename: `급여명세서_${variables.year}년${variables.month}월.pdf`,
          content: payslipPdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * 세무 보고서 이메일 발송
   */
  async sendTaxReport(
    to: string,
    excelFile: Buffer,
    variables: {
      companyName: string;
      year: string;
      month: string;
      employeeCount: string;
      totalPayroll: string;
      totalInsurance: string;
      totalTax: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = EMAIL_TEMPLATES.TAX_REPORT;

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html, variables);

    return this.send({
      to,
      subject,
      html,
      attachments: [
        {
          filename: `급여대장_${variables.year}년${variables.month}월.xlsx`,
          content: excelFile,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
  }

  /**
   * 스케줄 알림 이메일 발송
   */
  async sendScheduleNotification(
    to: string,
    variables: {
      staffName: string;
      workDate: string;
      storeName: string;
      startTime: string;
      endTime: string;
      position: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = EMAIL_TEMPLATES.SCHEDULE_NOTIFICATION;

    const html = this.replaceVariables(template.html, variables);

    return this.send({
      to,
      subject: template.subject,
      html,
    });
  }

  /**
   * 승인 요청 이메일 발송
   */
  async sendApprovalRequest(
    to: string,
    approvalId: string,
    variables: {
      approvalType: string;
      requesterName: string;
      requesterRole: string;
      requestDate: string;
      description: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = EMAIL_TEMPLATES.APPROVAL_REQUEST;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.abcstaff.kr';

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html, {
      ...variables,
      approveUrl: `${baseUrl}/approvals/${approvalId}/approve`,
      rejectUrl: `${baseUrl}/approvals/${approvalId}/reject`,
    });

    return this.send({
      to,
      subject,
      html,
    });
  }

  /**
   * 긴급 근무 모집 이메일 발송
   */
  async sendEmergencyShiftNotification(
    to: string | string[],
    shiftId: string,
    variables: {
      staffName: string;
      storeName: string;
      date: string;
      startTime: string;
      endTime: string;
      hourlyRate: string;
      bonus: string;
      reason: string;
      deadline: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = EMAIL_TEMPLATES.EMERGENCY_SHIFT;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.abcstaff.kr';

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html, {
      ...variables,
      applyUrl: `${baseUrl}/emergency-shifts/${shiftId}/apply`,
    });

    return this.send({
      to,
      subject,
      html,
    });
  }

  /**
   * 일반 알림 이메일 발송
   */
  async sendNotification(
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ABC Staff</h1>
          </div>
          <div class="content">
            ${body}
          </div>
          <div class="footer">
            <p>본 이메일은 ABC Staff에서 자동으로 발송되었습니다.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to,
      subject,
      html,
    });
  }

  /**
   * 대량 이메일 발송 (Resend batch API 사용)
   */
  async sendBatch(
    emails: Array<EmailOptions>
  ): Promise<{ success: boolean; results?: Array<{ success: boolean; messageId?: string }>; error?: string }> {
    try {
      const results = await Promise.all(
        emails.map(email => this.send(email))
      );

      return {
        success: results.every(r => r.success),
        results: results.map(r => ({
          success: r.success,
          messageId: r.messageId,
        })),
      };
    } catch (error) {
      console.error('Batch email send error:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

// 싱글톤 인스턴스
export const emailService = new EmailService();

export default EmailService;
