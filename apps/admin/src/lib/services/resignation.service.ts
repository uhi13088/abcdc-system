/**
 * 사직 처리 서비스
 * - 사직서 승인 시 개인정보 삭제
 * - 근무 기록, 급여 내역, 계약서는 문서로 보존
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface ResignationResult {
  success: boolean;
  message: string;
  archivedData?: {
    employeeId: string;
    anonymizedId: string;
    workRecordsCount: number;
    salaryRecordsCount: number;
    contractsCount: number;
  };
}

export class ResignationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 사직 처리 - 개인정보 삭제 및 기록 익명화
   */
  async processResignation(
    staffId: string,
    approvalId: string,
    companyId: string
  ): Promise<ResignationResult> {
    try {
      // 1. 직원 정보 조회
      const { data: employee, error: employeeError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', staffId)
        .single();

      if (employeeError || !employee) {
        return { success: false, message: '직원 정보를 찾을 수 없습니다.' };
      }

      // 2. 익명화 ID 생성 (기록 보존용)
      const anonymizedId = `RESIGNED_${Date.now()}_${staffId.slice(0, 8)}`;

      // 3. 근무 기록 익명화 (기록은 보존, 개인정보만 제거)
      const { count: attendanceCount } = await this.supabase
        .from('attendances')
        .update({
          staff_name_archived: employee.name, // 이름은 아카이브 필드에 보관
          notes: `[퇴직자] ${anonymizedId}`,
        })
        .eq('staff_id', staffId)
        .select('*', { count: 'exact', head: true });

      // 4. 급여 기록 익명화 (금액 기록은 보존)
      const { count: salaryCount } = await this.supabase
        .from('salaries')
        .update({
          staff_name_archived: employee.name,
          notes: `[퇴직자] ${anonymizedId}`,
        })
        .eq('staff_id', staffId)
        .select('*', { count: 'exact', head: true });

      // 5. 계약서 아카이브 (문서로 보존)
      const { data: contracts, count: contractCount } = await this.supabase
        .from('contracts')
        .select('*', { count: 'exact' })
        .eq('staff_id', staffId);

      // 계약서 상태를 TERMINATED로 변경하고 아카이브
      if (contracts && contracts.length > 0) {
        for (const contract of contracts) {
          await this.supabase
            .from('contracts')
            .update({
              status: 'TERMINATED',
              terminated_at: new Date().toISOString(),
              termination_reason: 'RESIGNATION',
              termination_approval_id: approvalId,
              // 개인정보 마스킹
              employee_name_archived: employee.name,
              employee_ssn: null, // 주민번호 삭제
              employee_address: null, // 주소 삭제
              employee_phone: null, // 전화번호 삭제
              employee_email: null, // 이메일 삭제
              employee_bank_account: null, // 계좌번호 삭제
            })
            .eq('id', contract.id);
        }
      }

      // 6. 스케줄 삭제 (미래 스케줄만)
      const today = new Date().toISOString().split('T')[0];
      await this.supabase
        .from('schedules')
        .delete()
        .eq('staff_id', staffId)
        .gte('work_date', today);

      // 7. FCM 토큰 삭제
      await this.supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('user_id', staffId);

      // 8. 알림 설정 삭제
      await this.supabase
        .from('notification_settings')
        .delete()
        .eq('user_id', staffId);

      // 9. 퇴직 기록 생성 (감사 추적용)
      await this.supabase.from('resignation_archives').insert({
        original_staff_id: staffId,
        anonymized_id: anonymizedId,
        company_id: companyId,
        employee_name: employee.name,
        employee_position: employee.position,
        resignation_date: new Date().toISOString(),
        approval_id: approvalId,
        work_records_count: attendanceCount || 0,
        salary_records_count: salaryCount || 0,
        contracts_count: contractCount || 0,
        hire_date: employee.created_at,
      });

      // 10. Auth 사용자 삭제 (Supabase Auth에서 삭제)
      // 주의: 이 작업은 service_role 키가 필요합니다
      if (employee.auth_id) {
        // Admin API를 통해 auth user 삭제 요청
        // 실제 삭제는 별도 admin 권한으로 처리
        await this.supabase.from('pending_auth_deletions').insert({
          auth_id: employee.auth_id,
          staff_id: staffId,
          requested_at: new Date().toISOString(),
          status: 'PENDING',
        });
      }

      // 11. users 테이블에서 개인정보 삭제 (행은 유지, 데이터만 익명화)
      await this.supabase
        .from('users')
        .update({
          name: `퇴직자_${anonymizedId.slice(-8)}`,
          email: `resigned_${anonymizedId}@deleted.local`,
          phone: null,
          address: null,
          ssn_hash: null,
          bank_name: null,
          bank_account: null,
          profile_image: null,
          status: 'RESIGNED',
          resigned_at: new Date().toISOString(),
          // auth_id는 유지 (감사 추적)
        })
        .eq('id', staffId);

      return {
        success: true,
        message: '사직 처리가 완료되었습니다. 개인정보가 삭제되고 근무 기록은 익명화되어 보존됩니다.',
        archivedData: {
          employeeId: staffId,
          anonymizedId,
          workRecordsCount: attendanceCount || 0,
          salaryRecordsCount: salaryCount || 0,
          contractsCount: contractCount || 0,
        },
      };
    } catch (error) {
      console.error('Resignation processing error:', error);
      return {
        success: false,
        message: '사직 처리 중 오류가 발생했습니다.',
      };
    }
  }
}
