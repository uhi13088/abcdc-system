'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  deep_link: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const categoryLabels: Record<string, string> = {
  SCHEDULE: '스케줄',
  ATTENDANCE: '출퇴근',
  SALARY: '급여',
  NOTICE: '공지',
  EMERGENCY: '긴급',
  EMERGENCY_SHIFT: '긴급근무',
  CONTRACT: '계약',
  APPROVAL: '승인',
  BILLING: '결제',
  HACCP: 'HACCP',
  SYSTEM: '시스템',
  ESCALATION: '에스컬레이션',
  REMINDER: '리마인더',
};

const categoryColors: Record<string, string> = {
  SCHEDULE: 'bg-blue-100 text-blue-700',
  ATTENDANCE: 'bg-green-100 text-green-700',
  SALARY: 'bg-purple-100 text-purple-700',
  NOTICE: 'bg-yellow-100 text-yellow-700',
  EMERGENCY: 'bg-red-100 text-red-700',
  EMERGENCY_SHIFT: 'bg-red-100 text-red-700',
  CONTRACT: 'bg-indigo-100 text-indigo-700',
  APPROVAL: 'bg-orange-100 text-orange-700',
  BILLING: 'bg-emerald-100 text-emerald-700',
  HACCP: 'bg-cyan-100 text-cyan-700',
  SYSTEM: 'bg-gray-100 text-gray-700',
  ESCALATION: 'bg-amber-100 text-amber-700',
  REMINDER: 'bg-sky-100 text-sky-700',
};

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter === 'unread') {
        params.set('unread', 'true');
      }

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch notifications');
      }

      const result = await response.json();
      setNotifications(result.data || []);
      setUnreadCount(result.unreadCount || 0);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [router, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const deleted = notifications.find((n) => n.id === notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (deleted && !deleted.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // 읽음 처리
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // 딥링크로 이동
    if (notification.deep_link) {
      router.push(notification.deep_link);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 safe-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Link href="/home" className="mr-3">
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">알림</h1>
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center text-sm text-primary font-medium"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              모두 읽음
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-3 text-sm font-medium ${
              filter === 'all'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-3 text-sm font-medium ${
              filter === 'unread'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500'
            }`}
          >
            읽지 않음 {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="pb-20">
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white p-4 ${!notification.read ? 'bg-blue-50/50' : ''}`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          categoryColors[notification.category] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {categoryLabels[notification.category] || notification.category}
                      </span>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                  <h3 className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {notification.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.body}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-3">
                  {!notification.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification.id);
                      }}
                      className="flex items-center text-xs text-gray-500 hover:text-primary"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      읽음
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notification.id);
                    }}
                    className="flex items-center text-xs text-gray-500 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Bell className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-400">
              {filter === 'unread' ? '읽지 않은 알림이 없습니다' : '알림이 없습니다'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 py-4">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => fetchNotifications(page)}
                className={`w-8 h-8 rounded-full text-sm ${
                  pagination.page === page
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
