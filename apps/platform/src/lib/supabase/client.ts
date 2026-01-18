import { createBrowserClient } from '@supabase/ssr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

const DEMO_URL = 'https://placeholder.supabase.co';
const DEMO_KEY = 'placeholder-key';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEMO_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_KEY;

  // Cookie domain for cross-subdomain auth (e.g., '.abcstaff.com')
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }
  );
}
