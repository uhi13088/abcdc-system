import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase/server';
import {
  Users,
  Clock,
  DollarSign,
  CheckSquare,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

async function getStats() {
  const supabase = createClient();

  // Get current user's company
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_id', user.id)
    .single();

  if (!userData?.company_id) return null;

  const companyId = userData.company_id;

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

  return {
    employeeCount: employeeCount || 0,
    checkedInCount: checkedInCount || 0,
    pendingApprovals: pendingApprovals || 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

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
      change: '+3',
      changeType: 'increase',
    },
    {
      title: '오늘 출근',
      value: stats?.checkedInCount || 0,
      icon: Clock,
      change: `${stats?.employeeCount ? Math.round((stats.checkedInCount / stats.employeeCount) * 100) : 0}%`,
      changeType: 'neutral',
    },
    {
      title: '이번 달 예상 급여',
      value: '12,500,000',
      icon: DollarSign,
      change: '+5.2%',
      changeType: 'increase',
      prefix: '₩',
    },
    {
      title: '대기중 승인',
      value: stats?.pendingApprovals || 0,
      icon: CheckSquare,
      change: '처리 필요',
      changeType: 'warning',
    },
  ];

  return (
    <div>
      <Header title="대시보드" />

      <div className="p-6 space-y-6">
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
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <Clock className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">홍길동</p>
                    <p className="text-xs text-gray-500">강남점</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">출근</p>
                  <p className="text-xs text-gray-500">09:00</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">김철수</p>
                    <p className="text-xs text-gray-500">홍대점</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">퇴근</p>
                  <p className="text-xs text-gray-500">18:30</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                    <Clock className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">이영희</p>
                    <p className="text-xs text-gray-500">강남점</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-orange-600">지각</p>
                  <p className="text-xs text-gray-500">09:15</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              대기중 승인 요청
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">휴가 신청</p>
                  <p className="text-xs text-gray-500">
                    박민수 - 1/15 ~ 1/17 (3일)
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100">
                    승인
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                    거부
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    초과근무 신청
                  </p>
                  <p className="text-xs text-gray-500">
                    김지영 - 1/12 (2시간)
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100">
                    승인
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                    거부
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">구매 요청</p>
                  <p className="text-xs text-gray-500">
                    최수정 - 청소용품 (50,000원)
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100">
                    승인
                  </button>
                  <button className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                    거부
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
