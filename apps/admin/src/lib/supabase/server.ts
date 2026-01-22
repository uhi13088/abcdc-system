import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

// Placeholder URL and key for demo mode when env vars are not set
const DEMO_URL = 'https://placeholder.supabase.co';
const DEMO_KEY = 'placeholder-key';

/**
 * Create a Supabase admin client with service role key
 * Use this for admin operations like creating users
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEMO_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Service Role Key가 없으면 경고 로그
  if (!supabaseServiceKey) {
    console.warn('[WARN] SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations will fail.');
    console.warn('[WARN] Please set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.');
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey || DEMO_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Check if admin client is properly configured
 */
export function isAdminClientConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEMO_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_KEY;

  return createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
