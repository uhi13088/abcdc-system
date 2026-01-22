import { createBrowserClient } from '@supabase/ssr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

// Dummy values for build time (must be valid URL format for @supabase/ssr validation)
const BUILD_TIME_URL = 'https://build-placeholder.supabase.co';
const BUILD_TIME_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aWxkLXBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDAwMDAwMDAsImV4cCI6MTk1NTYwMDAwMH0.placeholder';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time (server-side without env vars), return a dummy client
  if (typeof window === 'undefined' && (!supabaseUrl || !supabaseKey)) {
    return createBrowserClient<Database>(BUILD_TIME_URL, BUILD_TIME_KEY);
  }

  // In browser without env vars, throw an error
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    throw new Error(
      'Supabase 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요.'
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
