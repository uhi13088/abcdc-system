'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Phone,
  Mail,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  position: string | null;
  created_at: string;
  stores: { id: string; name: string } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id, name, phone, email, position, created_at, stores(id, name)')
          .eq('id', authUser.id)
          .single();

        if (userData) {
          // Supabase returns relations as arrays, extract first element
          const storeData = Array.isArray(userData.stores) ? userData.stores[0] : userData.stores;
          setProfile({
            id: userData.id,
            name: userData.name,
            phone: userData.phone,
            email: userData.email,
            position: userData.position,
            created_at: userData.created_at,
            stores: storeData || null,
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [supabase, router]);

  const menuItems = [
    { icon: FileText, label: '근로계약서', href: '/profile/contract' },
    { icon: DollarSign, label: '급여 명세서', href: '/profile/salary' },
    { icon: Settings, label: '알림 설정', href: '/profile/settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const formatJoinDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <h1 className="text-xl font-bold text-gray-900">내 정보</h1>
      </div>

      {/* Profile Card */}
      <div className="p-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-900">{profile?.name || '-'}</h2>
              <p className="text-gray-500">{profile?.position || '직원'}</p>
              <div className="flex items-center mt-1 text-sm text-gray-400">
                <Building2 className="w-4 h-4 mr-1" />
                {profile?.stores?.name || '매장 미배정'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="px-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-xs text-gray-400">연락처</p>
              <p className="font-medium text-gray-900">{profile?.phone || '-'}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-xs text-gray-400">이메일</p>
              <p className="font-medium text-gray-900">{profile?.email || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center justify-between p-4 ${
                index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center">
                <item.icon className="w-5 h-5 text-gray-400 mr-3" />
                <span className="font-medium text-gray-900">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Logout Button */}
      <div className="px-4">
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-center text-red-500 font-medium"
        >
          <LogOut className="w-5 h-5 mr-2" />
          로그아웃
        </button>
      </div>

      {/* App Info */}
      <div className="p-4 text-center">
        <p className="text-xs text-gray-400">ABC Staff v1.0.0</p>
        {profile?.created_at && (
          <p className="text-xs text-gray-400 mt-1">입사일: {formatJoinDate(profile.created_at)}</p>
        )}
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">로그아웃</h3>
            <p className="text-gray-500 text-center mb-6">정말 로그아웃 하시겠습니까?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
