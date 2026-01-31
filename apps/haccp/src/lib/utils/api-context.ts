/**
 * HACCP API 컨텍스트 유틸리티
 * 사용자 정보 및 매장 컨텍스트 조회
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface HaccpApiContext {
  userId: string;
  userName: string;
  companyId: string;
  storeId: string | null;  // 현재 선택된 HACCP 매장 (current_haccp_store_id 우선)
  role: string;
}

/**
 * HACCP API 컨텍스트 조회
 * - 사용자 정보 및 매장 컨텍스트를 반환
 * - HACCP 앱에서는 current_haccp_store_id를 우선 사용
 * - 없으면 current_store_id, 그 다음 store_id 순으로 폴백
 */
export async function getHaccpApiContext(
  adminClient: SupabaseClient,
  authUserId: string
): Promise<HaccpApiContext | null> {
  const { data: userProfile } = await adminClient
    .from('users')
    .select('id, name, role, company_id, store_id, current_store_id, current_haccp_store_id')
    .eq('auth_id', authUserId)
    .single();

  if (!userProfile?.company_id) {
    return null;
  }

  // HACCP 매장 우선순위: current_haccp_store_id > current_store_id > store_id
  const storeId = userProfile.current_haccp_store_id
    || userProfile.current_store_id
    || userProfile.store_id
    || null;

  return {
    userId: userProfile.id,
    userName: userProfile.name,
    companyId: userProfile.company_id,
    storeId,
    role: userProfile.role,
  };
}

/**
 * 쿼리에 store_id 필터 추가
 * - store_id가 있으면 필터 추가
 * - 없으면 company_id로만 필터 (하위 호환)
 */
export function addStoreFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  context: HaccpApiContext
): T {
  if (context.storeId) {
    return query.eq('store_id', context.storeId);
  }
  return query;
}

/**
 * 새 레코드에 store_id 추가
 */
export function withStoreId<T extends object>(
  data: T,
  context: HaccpApiContext
): T & { store_id?: string } {
  if (context.storeId) {
    return { ...data, store_id: context.storeId };
  }
  return data;
}
