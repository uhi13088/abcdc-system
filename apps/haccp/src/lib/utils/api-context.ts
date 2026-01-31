/**
 * HACCP API 컨텍스트 유틸리티
 * 사용자 정보 및 매장 컨텍스트 조회
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface HaccpApiContext {
  userId: string;
  userName: string;
  companyId: string;
  storeId: string | null;  // 현재 선택된 매장 (current_store_id 또는 store_id)
  role: string;
}

/**
 * HACCP API 컨텍스트 조회
 * - 사용자 정보 및 매장 컨텍스트를 반환
 * - current_store_id가 있으면 사용, 없으면 store_id 사용
 */
export async function getHaccpApiContext(
  adminClient: SupabaseClient,
  authUserId: string
): Promise<HaccpApiContext | null> {
  const { data: userProfile } = await adminClient
    .from('users')
    .select('id, name, role, company_id, store_id, current_store_id')
    .eq('auth_id', authUserId)
    .single();

  if (!userProfile?.company_id) {
    return null;
  }

  return {
    userId: userProfile.id,
    userName: userProfile.name,
    companyId: userProfile.company_id,
    storeId: userProfile.current_store_id || userProfile.store_id || null,
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
