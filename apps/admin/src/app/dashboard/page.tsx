import { Header } from '@/components/layout/header';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  Users,
  Clock,
  DollarSign,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Store,
  Crown,
} from 'lucide-react';

// Designated super_admin email
const SUPER_ADMIN_EMAIL = 'uhi1308@naver.com';

async function getStats() {
  try {
    const supabase = await createClient();

    // Get current user's company
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role, email')
      .eq('auth_id', user.id)
      .single();

    // If no company_id, user just registered and needs setup
    if (!userData) return { needsSetup: true };

    // Auto-fix super_admin role for designated email
    if (userData.email === SUPER_ADMIN_EMAIL && userData.role !== 'super_admin') {
      const adminClient = createAdminClient();
      await adminClient
        .from('users')
        .update({ role: 'super_admin', company_id: null })
        .eq('auth_id', user.id);
      // Update local data for this request
      userData.role = 'super_admin';
      userData.company_id = null;
    }

    const companyId = userData.company_id;

    // For users without company, show setup message
    if (!companyId) {
      return { needsSetup: true, role: userData.role };
    }

    // Get employee count (exclude company_admin and super_admin)
    const { count: employeeCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .not('role', 'in', '("company_admin","super_admin")');

    // Try to get subscription info, fallback to free tier defaults
    let currentPlan = {
      name: 'Free',
      maxEmployees: 10,
      maxStores: 1,
    };

    // Query subscription and plan info
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select(`
        status,
        subscription_plans (
          name,
          display_name,
          max_employees,
          max_stores
        )
      `)
      .eq('company_id', companyId)
      .maybeSingle();

    if (subscription?.subscription_plans) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = subscription.subscription_plans as any;
      currentPlan = {
        name: plan.display_name || plan.name || 'Free',
        maxEmployees: plan.max_employees === -1 ? 9999 : (plan.max_employees || 10),
        maxStores: plan.max_stores === -1 ? 9999 : (plan.max_stores || 1),
      };
    }

    // Get store count
    const { count: storeCount } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0];
    const { count: checkedInCount } = await supabase
      .from('attendances')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('work_date', today)
      .not('actual_check_in', 'is', null);

    // Get pending approvals
    const { count: pendingApprovals } = await supabase
      .from('approval_requests')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('final_status', 'PENDING');

    // Get recent attendance records
    const { data: recentAttendances } = await supabase
      .from('attendances')
      .select(`
        id,
        actual_check_in,
        actual_check_out,
        work_date,
        users (name),
        stores (name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get pending approval requests
    const { data: pendingRequests } = await supabase
      .from('approval_requests')
      .select(`
        id,
        type,
        title,
        created_at,
        users!approval_requests_requester_id_fkey (name)
      `)
      .eq('company_id', companyId)
      .eq('final_status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      employeeCount: employeeCount || 0,
      checkedInCount: checkedInCount || 0,
      pendingApprovals: pendingApprovals || 0,
      recentAttendances: recentAttendances || [],
      pendingRequests: pendingRequests || [],
      needsSetup: false,
      subscription: {
        plan: currentPlan,
        storeCount: storeCount || 0,
      },
    };
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return null;
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  // Check if user has no company (optional - show info banner)
  const showCompanyBanner = stats?.needsSetup;

  const cards: Array<{
    title: string;
    value: number | string;
    icon: typeof Users;
    change: string;
    changeType: 'increase' | 'decrease' | 'neutral' | 'warning';
    prefix?: string;
  }> = [
    {
      title: '전체 직원',
      value: stats?.employeeCount || 0,
      icon: Users,
      change: '명',
      changeType: 'neutral',
    },
    {
      title: '오늘 출근',
      value: stats?.checkedInCount || 0,
      icon: Clock,
      change: `${stats?.employeeCount ? Math.round(((stats.checkedInCount || 0) / stats.employeeCount) * 100) : 0}%`,
      changeType: 'neutral',
    },
    {
      title: '이번 달 예상 급여',
      value: '-',
      icon: DollarSign,
      change: '급여 > 급여 내역에서 확인',
      changeType: 'neutral',
      prefix: '',
    },
    {
      title: '대기중 승인',
      value: stats?.pendingApprovals || 0,
      icon: CheckSquare,
      change: stats?.pendingApprovals ? '처리 필요' : '없음',
      changeType: stats?.pendingApprovals ? 'warning' : 'neutral',
    },
  ];

  return (
    <div>
      <Header title="대시보드" />

      <div className="p-6 space-y-6">
        {/* Optional company setup banner */}
        {showCompanyBanner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-blue-500 mr-3" />
              <p className="text-sm text-blue-700">
                회사 정보를 등록하면 직원 관리, 급여 계산 등 더 많은 기능을 사용할 수 있습니다.
              </p>
            </div>
            <a
              href="/settings"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap ml-4"
            >
              설정하기 &rarr;
            </a>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {card.title}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {card.prefix}
                    {typeof card.value === 'number'
                      ? card.value.toLocaleString()
                      : card.value}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                {card.changeType === 'increase' && (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                )}
                {card.changeType === 'decrease' && (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span
                  className={
                    card.changeType === 'increase'
                      ? 'text-green-600'
                      : card.changeType === 'decrease'
                        ? 'text-red-600'
                        : card.changeType === 'warning'
                          ? 'text-orange-600'
                          : 'text-gray-600'
                  }
                >
                  {card.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Subscription Usage */}
        {stats?.subscription && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Crown className="w-5 h-5 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">요금제 사용량</h2>
              </div>
              <span className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
                {stats.subscription.plan.name}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employee Usage */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-1" />
                    직원 수
                  </div>
                  <span className="text-sm font-medium">
                    {stats.employeeCount} / {stats.subscription.plan.maxEmployees}명
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (stats.employeeCount / stats.subscription.plan.maxEmployees) >= 0.9
                        ? 'bg-red-500'
                        : (stats.employeeCount / stats.subscription.plan.maxEmployees) >= 0.7
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min((stats.employeeCount / stats.subscription.plan.maxEmployees) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.subscription.plan.maxEmployees - stats.employeeCount}명 남음
                </p>
              </div>
              {/* Store Usage */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Store className="w-4 h-4 mr-1" />
                    매장 수
                  </div>
                  <span className="text-sm font-medium">
                    {stats.subscription.storeCount} / {stats.subscription.plan.maxStores}개
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (stats.subscription.storeCount / stats.subscription.plan.maxStores) >= 0.9
                        ? 'bg-red-500'
                        : (stats.subscription.storeCount / stats.subscription.plan.maxStores) >= 0.7
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((stats.subscription.storeCount / stats.subscription.plan.maxStores) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.subscription.plan.maxStores - stats.subscription.storeCount}개 남음
                </p>
              </div>
            </div>
            {((stats.employeeCount / stats.subscription.plan.maxEmployees) >= 0.9 ||
              (stats.subscription.storeCount / stats.subscription.plan.maxStores) >= 0.9) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center text-sm text-yellow-700">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  한도에 도달하기 전에 요금제를 업그레이드하세요.
                </div>
                <a href="/settings?tab=subscription" className="text-sm font-medium text-yellow-700 hover:text-yellow-800">
                  업그레이드 →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Check-ins */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              최근 출퇴근
            </h2>
            <div className="space-y-4">
              {stats?.recentAttendances && stats.recentAttendances.length > 0 ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                stats.recentAttendances.map((attendance: any) => (
                  <div key={attendance.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 ${attendance.actual_check_out ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center mr-3`}>
                        <Clock className={`w-4 h-4 ${attendance.actual_check_out ? 'text-blue-600' : 'text-green-600'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {attendance.users?.name || '이름 없음'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {attendance.stores?.name || '매장 정보 없음'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${attendance.actual_check_out ? 'text-blue-600' : 'text-green-600'}`}>
                        {attendance.actual_check_out ? '퇴근' : '출근'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attendance.actual_check_out
                          ? new Date(attendance.actual_check_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                          : attendance.actual_check_in
                            ? new Date(attendance.actual_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                            : '-'
                        }
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>출퇴근 기록이 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              대기중 승인 요청
            </h2>
            <div className="space-y-4">
              {stats?.pendingRequests && stats.pendingRequests.length > 0 ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                stats.pendingRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {request.title || request.type}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.users?.name || '요청자 정보 없음'} - {new Date(request.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <a
                      href={`/approvals?id=${request.id}`}
                      className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20"
                    >
                      상세보기
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>대기중인 승인 요청이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
