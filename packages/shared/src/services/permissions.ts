import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 애드온 접근 권한 체크 함수들
 */

// Internal interfaces for this module - not exported to avoid conflicts with entities.ts
interface _UserAddonAccess {
  haccp_access: boolean | null;
  roasting_access: boolean | null;
  store_id: string | null;
  company_id: string | null;
}

interface _StoreAddonSettings {
  haccp_enabled: boolean;
  roasting_enabled: boolean;
}

interface _CompanySubscription {
  haccp_addon_enabled: boolean;
  roasting_addon_enabled: boolean;
}

// Re-export with underscore prefix to avoid ESLint warnings about unused interfaces
export type { _UserAddonAccess as UserAddonAccess_Permissions };
export type { _StoreAddonSettings as StoreAddonSettings_Permissions };
export type { _CompanySubscription as CompanySubscription_Permissions };

/**
 * 로스팅 애드온 접근 권한 체크
 *
 * 접근 허용 조건:
 * 1. 회사가 로스팅 애드온 구독 중 AND
 * 2. (사용자 레벨 roasting_access가 true) OR (소속 매장의 roasting_enabled가 true)
 */
export async function hasRoastingAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    // 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('roasting_access, store_id, company_id')
      .eq('id', userId)
      .single();

    if (userError || !user) return false;

    // 회사 구독 정보 조회
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('roasting_addon_enabled')
      .eq('company_id', user.company_id)
      .single();

    // 1. 회사가 로스팅 애드온 구독 중인지 확인
    const companyHasAddon = subscription?.roasting_addon_enabled || false;
    if (!companyHasAddon) return false;

    // 2. 사용자 레벨 오버라이드 체크
    if (user.roasting_access) return true;

    // 3. 매장 레벨 체크
    if (user.store_id) {
      const { data: store } = await supabase
        .from('stores')
        .select('roasting_enabled')
        .eq('id', user.store_id)
        .single();

      if (store?.roasting_enabled) return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to check roasting access:', error);
    return false;
  }
}

/**
 * HACCP 애드온 접근 권한 체크
 *
 * 접근 허용 조건:
 * 1. 회사가 HACCP 애드온 구독 중 AND
 * 2. (사용자 레벨 haccp_access가 true) OR (소속 매장의 haccp_enabled가 true)
 */
export async function hasHaccpAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    // 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('haccp_access, store_id, company_id')
      .eq('id', userId)
      .single();

    if (userError || !user) return false;

    // 회사 구독 정보 조회
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('haccp_addon_enabled')
      .eq('company_id', user.company_id)
      .single();

    // 1. 회사가 HACCP 애드온 구독 중인지 확인
    const companyHasAddon = subscription?.haccp_addon_enabled || false;
    if (!companyHasAddon) return false;

    // 2. 사용자 레벨 오버라이드 체크
    if (user.haccp_access) return true;

    // 3. 매장 레벨 체크
    if (user.store_id) {
      const { data: store } = await supabase
        .from('stores')
        .select('haccp_enabled')
        .eq('id', user.store_id)
        .single();

      if (store?.haccp_enabled) return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to check HACCP access:', error);
    return false;
  }
}

/**
 * 모든 애드온 접근 권한 한번에 체크
 */
export async function checkAddonAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<{ haccp: boolean; roasting: boolean }> {
  try {
    // 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('haccp_access, roasting_access, store_id, company_id, role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { haccp: false, roasting: false };
    }

    // super_admin has access to all addons
    if (user.role === 'super_admin') {
      return { haccp: true, roasting: true };
    }

    // 회사 구독 정보 조회
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('haccp_addon_enabled, roasting_addon_enabled')
      .eq('company_id', user.company_id)
      .single();

    const companyHasHaccp = subscription?.haccp_addon_enabled || false;
    const companyHasRoasting = subscription?.roasting_addon_enabled || false;

    // 둘 다 구독 안 하면 빠른 반환
    if (!companyHasHaccp && !companyHasRoasting) {
      return { haccp: false, roasting: false };
    }

    // 매장 정보 조회 (있는 경우만)
    let storeHaccp = false;
    let storeRoasting = false;
    if (user.store_id) {
      const { data: store } = await supabase
        .from('stores')
        .select('haccp_enabled, roasting_enabled')
        .eq('id', user.store_id)
        .single();

      storeHaccp = store?.haccp_enabled || false;
      storeRoasting = store?.roasting_enabled || false;
    }

    return {
      haccp: companyHasHaccp && (user.haccp_access || storeHaccp),
      roasting: companyHasRoasting && (user.roasting_access || storeRoasting),
    };
  } catch (error) {
    console.error('Failed to check addon access:', error);
    return { haccp: false, roasting: false };
  }
}

/**
 * Auth ID로 애드온 접근 권한 체크 (로그인 사용자용)
 */
export async function checkAddonAccessByAuthId(
  supabase: SupabaseClient,
  authId: string
): Promise<{ haccp: boolean; roasting: boolean }> {
  try {
    // Auth ID로 사용자 ID 조회
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();

    if (!user) {
      return { haccp: false, roasting: false };
    }

    return checkAddonAccess(supabase, user.id);
  } catch (error) {
    console.error('Failed to check addon access by auth ID:', error);
    return { haccp: false, roasting: false };
  }
}
