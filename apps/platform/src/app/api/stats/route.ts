import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/stats - Platform dashboard statistics
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get total companies
    const { count: totalCompanies } = await adminClient
      .from('companies')
      .select('*', { count: 'exact', head: true });

    // Get active companies (with at least one active user)
    const { count: activeCompanies } = await adminClient
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    // Get total users (excluding super_admin)
    const { count: totalUsers } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'super_admin');

    // Get monthly active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: monthlyActiveUsers } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'super_admin')
      .gte('last_login_at', thirtyDaysAgo.toISOString());

    // Get total brands
    const { count: totalBrands } = await adminClient
      .from('brands')
      .select('*', { count: 'exact', head: true });

    // Get total stores
    const { count: totalStores } = await adminClient
      .from('stores')
      .select('*', { count: 'exact', head: true });

    // Get recent activities (last company registrations, user additions, etc.)
    const { data: recentCompanies } = await adminClient
      .from('companies')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentUsers } = await adminClient
      .from('users')
      .select('id, name, company_id, created_at, companies(name)')
      .neq('role', 'super_admin')
      .order('created_at', { ascending: false })
      .limit(5);

    // Combine and sort recent activities
    const activities = [
      ...(recentCompanies || []).map(c => ({
        id: `company-${c.id}`,
        company: c.name,
        action: '신규 가입',
        time: c.created_at,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(recentUsers || []).map((u: any) => {
        const companyData = Array.isArray(u.companies) ? u.companies[0] : u.companies;
        return {
          id: `user-${u.id}`,
          company: companyData?.name || '알 수 없음',
          action: `${u.name} 사용자 추가`,
          time: u.created_at,
        };
      }),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5)
      .map(a => ({
        ...a,
        time: getRelativeTime(a.time),
      }));

    return NextResponse.json({
      totalCompanies: totalCompanies || 0,
      activeCompanies: activeCompanies || 0,
      totalUsers: totalUsers || 0,
      monthlyActiveUsers: monthlyActiveUsers || 0,
      totalBrands: totalBrands || 0,
      totalStores: totalStores || 0,
      recentActivities: activities,
      serverStatus: 'healthy',
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR');
}
