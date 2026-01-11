import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase/server';
import {
  Users,
  Clock,
  DollarSign,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';

async function getStats() {
  try {
    const supabase = createClient();

    // Get current user's company
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', user.id)
      .single();

    // If no company_id, user just registered and needs setup
    if (!userData) return { needsSetup: true };

    const companyId = userData.company_id;

    // For users without company, show setup message
    if (!companyId) {
      return { needsSetup: true, role: userData.role };
    }

    // Get employee count
    const { count: employeeCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE');

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

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Check-ins */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              최근 출퇴근
            </h2>
            <div className="space-y-4">
              {stats?.recentAttendances && stats.recentAttendances.length > 0 ? (
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
