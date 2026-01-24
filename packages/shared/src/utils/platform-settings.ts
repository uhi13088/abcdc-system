import { SupabaseClient } from '@supabase/supabase-js';

export interface PlatformSettings {
  platform_name: string;
  support_email: string;
  max_users_per_company: number;
  max_stores_per_company: number;
  enable_registration: boolean;
  require_email_verification: boolean;
  enable_two_factor: boolean;
  maintenance_mode: boolean;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: 'Peanote',
  support_email: 'support@abcstaff.com',
  max_users_per_company: 100,
  max_stores_per_company: 50,
  enable_registration: true,
  require_email_verification: true,
  enable_two_factor: false,
  maintenance_mode: false,
};

// Cache for platform settings (5 minutes)
let cachedSettings: PlatformSettings | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getPlatformSettings(
  supabase: SupabaseClient
): Promise<PlatformSettings> {
  // Check cache first
  if (cachedSettings && Date.now() < cacheExpiry) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .single();

    if (error || !data) {
      console.warn('Failed to fetch platform settings, using defaults:', error?.message);
      return DEFAULT_SETTINGS;
    }

    cachedSettings = {
      platform_name: data.platform_name ?? DEFAULT_SETTINGS.platform_name,
      support_email: data.support_email ?? DEFAULT_SETTINGS.support_email,
      max_users_per_company: data.max_users_per_company ?? DEFAULT_SETTINGS.max_users_per_company,
      max_stores_per_company: data.max_stores_per_company ?? DEFAULT_SETTINGS.max_stores_per_company,
      enable_registration: data.enable_registration ?? DEFAULT_SETTINGS.enable_registration,
      require_email_verification: data.require_email_verification ?? DEFAULT_SETTINGS.require_email_verification,
      enable_two_factor: data.enable_two_factor ?? DEFAULT_SETTINGS.enable_two_factor,
      maintenance_mode: data.maintenance_mode ?? DEFAULT_SETTINGS.maintenance_mode,
    };
    cacheExpiry = Date.now() + CACHE_DURATION;

    return cachedSettings;
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Clear cache (call when settings are updated)
export function clearPlatformSettingsCache() {
  cachedSettings = null;
  cacheExpiry = 0;
}

// Check if company can add more users
export async function canAddUser(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ allowed: boolean; reason?: string; currentCount?: number; maxCount?: number }> {
  const settings = await getPlatformSettings(supabase);

  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'ACTIVE');

  if (error) {
    console.error('Error counting users:', error);
    return { allowed: true }; // Allow on error to not block operations
  }

  const currentCount = count || 0;
  const maxCount = settings.max_users_per_company;

  if (currentCount >= maxCount) {
    return {
      allowed: false,
      reason: `최대 사용자 수(${maxCount}명)에 도달했습니다. 플랜을 업그레이드하거나 관리자에게 문의하세요.`,
      currentCount,
      maxCount,
    };
  }

  return { allowed: true, currentCount, maxCount };
}

// Check if company can add more stores
export async function canAddStore(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ allowed: boolean; reason?: string; currentCount?: number; maxCount?: number }> {
  const settings = await getPlatformSettings(supabase);

  const { count, error } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (error) {
    console.error('Error counting stores:', error);
    return { allowed: true }; // Allow on error to not block operations
  }

  const currentCount = count || 0;
  const maxCount = settings.max_stores_per_company;

  if (currentCount >= maxCount) {
    return {
      allowed: false,
      reason: `최대 매장 수(${maxCount}개)에 도달했습니다. 플랜을 업그레이드하거나 관리자에게 문의하세요.`,
      currentCount,
      maxCount,
    };
  }

  return { allowed: true, currentCount, maxCount };
}

// Check if registration is allowed
export async function isRegistrationAllowed(
  supabase: SupabaseClient
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getPlatformSettings(supabase);

  if (!settings.enable_registration) {
    return {
      allowed: false,
      reason: '현재 신규 가입이 중단되었습니다. 관리자에게 문의하세요.',
    };
  }

  return { allowed: true };
}

// Check if maintenance mode is active
export async function isMaintenanceMode(
  supabase: SupabaseClient
): Promise<boolean> {
  const settings = await getPlatformSettings(supabase);
  return settings.maintenance_mode;
}
