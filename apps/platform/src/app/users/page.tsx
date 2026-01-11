'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Shield, Building2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_name: string;
  status: 'active' | 'inactive';
  last_login: string;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    setUsers([
      { id: '1', name: '관리자', email: 'admin@abc.com', role: 'super_admin', company_name: 'ABC Platform', status: 'active', last_login: '2024-01-10 09:30', created_at: '2023-01-01' },
      { id: '2', name: '김사장', email: 'kim@chicken.com', role: 'company_admin', company_name: '맛있는 치킨', status: 'active', last_login: '2024-01-10 08:15', created_at: '2024-01-15' },
      { id: '3', name: '이매니저', email: 'lee@chicken.com', role: 'manager', company_name: '맛있는 치킨', status: 'active', last_login: '2024-01-09 18:30', created_at: '2024-01-20' },
      { id: '4', name: '박대표', email: 'park@cafemoca.com', role: 'company_admin', company_name: '카페모카 프랜차이즈', status: 'active', last_login: '2024-01-10 10:00', created_at: '2023-11-10' },
      { id: '5', name: '최점장', email: 'choi@cafemoca.com', role: 'store_manager', company_name: '카페모카 프랜차이즈', status: 'active', last_login: '2024-01-10 07:00', created_at: '2023-12-01' },
      { id: '6', name: '정직원', email: 'jung@chicken.com', role: 'staff', company_name: '맛있는 치킨', status: 'inactive', last_login: '2024-01-05 15:00', created_at: '2024-02-01' },
    ]);
    setLoading(false);
  }, []);

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800',
      company_admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-green-100 text-green-800',
      store_manager: 'bg-yellow-100 text-yellow-800',
      team_leader: 'bg-orange-100 text-orange-800',
      staff: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      company_admin: 'Company Admin',
      manager: '관리자',
      store_manager: '점장',
      team_leader: '팀장',
      staff: '직원',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[role] || 'bg-gray-100 text-gray-800'}`}>
        {labels[role] || role}
      </span>
    );
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
          <p className="text-gray-600">플랫폼의 모든 사용자를 관리합니다</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700">
          <UserPlus className="w-5 h-5 mr-2" />
          사용자 추가
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="이름, 이메일, 회사명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">모든 역할</option>
          <option value="super_admin">Super Admin</option>
          <option value="company_admin">Company Admin</option>
          <option value="manager">관리자</option>
          <option value="store_manager">점장</option>
          <option value="staff">직원</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마지막 로그인</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="flex items-center text-sm text-gray-500">
                    <Building2 className="w-4 h-4 mr-1" />
                    {user.company_name}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.last_login}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
