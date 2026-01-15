import { createBrowserClient } from '@supabase/ssr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    throw new Error(
      'Supabase 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요.'
    );
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseKey
  );
}
