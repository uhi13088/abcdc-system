/**
 * 검증(승인) 권한 체크 유틸리티
 */

import { createClient } from '@/lib/supabase/server';

// 역할 계층 정의 (높은 권한 → 낮은 권한)
export const ROLE_HIERARCHY = [
  'super_admin',
  'company_admin',
  'manager',
  'store_manager',
  'team_leader',
  'staff',
] as const;

export type UserRole = (typeof ROLE_HIERARCHY)[number];

// 역할 표시명 (한글)
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '슈퍼 관리자',
  company_admin: '회사 관리자',
  manager: '매니저',
  store_manager: '매장 관리자',
  team_leader: '팀장',
  staff: '직원',
};

// 기록 유형
export type RecordType =
  | 'hygiene'
  | 'ccp'
  | 'storage'
  | 'pest_control'
  | 'calibration'
  | 'training'
  | 'corrective_action';

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  hygiene: '위생점검',
  ccp: 'CCP 모니터링',
  storage: '저장소 점검',
  pest_control: '방충방서 점검',
  calibration: '검교정 기록',
  training: '교육훈련 기록',
  corrective_action: '개선조치',
};

interface VerificationSettings {
  verification_min_role: UserRole;
  allow_self_verification: boolean;
  verification_roles_by_type: Record<string, UserRole>;
}

/**
 * 역할이 최소 요구 역할 이상인지 확인
 */
export function hasMinimumRole(userRole: string, minRole: UserRole): boolean {
  const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole as UserRole);
  const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

  // 역할을 찾을 수 없으면 권한 없음
  if (userRoleIndex === -1) return false;

  // 인덱스가 작을수록 높은 권한
  return userRoleIndex <= minRoleIndex;
}

/**
 * 검증 권한 체크
 */
export async function checkVerificationPermission(
  companyId: string,
  verifierUserId: string,
  verifierRole: string,
  recordType: RecordType,
  recordCreatorId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = await createClient();

  // 1. 회사 검증 설정 조회
  const { data: settings } = await supabase
    .from('haccp_company_settings')
    .select(
      'verification_min_role, allow_self_verification, verification_roles_by_type'
    )
    .eq('company_id', companyId)
    .single();

  const verificationSettings: VerificationSettings = {
    verification_min_role: settings?.verification_min_role || 'manager',
    allow_self_verification: settings?.allow_self_verification ?? false,
    verification_roles_by_type: settings?.verification_roles_by_type || {},
  };

  // 2. 해당 기록 유형의 최소 역할 확인 (유형별 설정이 없으면 기본 설정 사용)
  const minRole =
    verificationSettings.verification_roles_by_type[recordType] ||
    verificationSettings.verification_min_role;

  // 3. 역할 권한 체크
  if (!hasMinimumRole(verifierRole, minRole)) {
    return {
      allowed: false,
      reason: `검증 권한이 없습니다. 최소 '${ROLE_LABELS[minRole]}' 이상의 역할이 필요합니다.`,
    };
  }

  // 4. 본인 검증 체크
  if (
    !verificationSettings.allow_self_verification &&
    recordCreatorId &&
    recordCreatorId === verifierUserId
  ) {
    return {
      allowed: false,
      reason:
        '본인이 작성한 기록은 본인이 검증할 수 없습니다. 다른 담당자에게 검증을 요청하세요.',
    };
  }

  return { allowed: true };
}

/**
 * 현재 사용자가 검증 가능한지 간단히 체크 (역할만 확인)
 */
export function canVerifyByRole(
  userRole: string,
  minRole: UserRole = 'manager'
): boolean {
  return hasMinimumRole(userRole, minRole);
}
