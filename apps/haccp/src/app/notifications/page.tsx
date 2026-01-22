'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Info,
  AlertCircle,
  Settings,
  Clock,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  deep_link?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  offset: number;
  limit: number;
}

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const fetchNotifications = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'unread') params.set('is_read', 'false');

      const response = await fetch(`/api/haccp/notifications?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/haccp/notifications/${id}`, {
        method: 'PUT',
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/haccp/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      const response = await fetch('/api/haccp/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notification_ids: Array.from(selectedIds),
        }),
      });
      if (response.ok) {
        setSelectedIds(new Set());
        setSelectAll(false);
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to mark selected as read:', error);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개의 알림을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/haccp/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          notification_ids: Array.from(selectedIds),
        }),
      });
      if (response.ok) {
        setSelectedIds(new Set());
        setSelectAll(false);
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to delete notifications:', error);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data?.notifications.map(n => n.id) || []));
    }
    setSelectAll(!selectAll);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const priorityIcons: Record<string, React.ReactNode> = {
    LOW: <Info className="w-4 h-4 text-gray-400" />,
    NORMAL: <Bell className="w-4 h-4 text-blue-500" />,
    HIGH: <AlertTriangle className="w-4 h-4 text-orange-500" />,
    CRITICAL: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  const priorityColors: Record<string, string> = {
    LOW: 'border-l-gray-300',
    NORMAL: 'border-l-blue-400',
    HIGH: 'border-l-orange-400',
    CRITICAL: 'border-l-red-500',
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">알림</h1>
          <p className="mt-1 text-sm text-gray-500">
            HACCP 관련 알림 및 리마인더
            {data?.unreadCount ? ` · 읽지 않은 알림 ${data.unreadCount}개` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <Link
            href="/notifications/settings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            설정
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-gray-500">전체 알림</p>
          </div>
          <p className="text-2xl font-bold">{data?.total || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <BellOff className="w-4 h-4 text-orange-500" />
            <p className="text-sm text-gray-500">읽지 않은 알림</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">{data?.unreadCount || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-gray-500">긴급 알림</p>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {data?.notifications.filter(n => n.priority === 'CRITICAL' && !n.read).length || 0}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="all">전체</option>
              <option value="unread">읽지 않은 알림</option>
            </select>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{selectedIds.size}개 선택됨</span>
              <button
                onClick={markSelectedAsRead}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Check className="w-4 h-4" />
                읽음 처리
              </button>
              <button
                onClick={deleteSelected}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            </div>
          )}
        </div>

        {data && data.unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <CheckCheck className="w-4 h-4" />
            모두 읽음
          </button>
        )}
      </div>

      {/* Notifications List */}
      {!data?.notifications || data.notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">
            {filter === 'unread' ? '읽지 않은 알림이 없습니다' : '알림이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Select All Header */}
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span className="text-sm text-gray-500">전체 선택</span>
          </div>

          <div className="divide-y">
            {data.notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors border-l-4 ${
                  priorityColors[notification.priority]
                } ${!notification.read ? 'bg-blue-50/30' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(notification.id)}
                  onChange={() => toggleSelect(notification.id)}
                  className="mt-1 rounded"
                />

                <div className="flex-shrink-0 mt-0.5">
                  {priorityIcons[notification.priority]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">{notification.body}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {notification.category}
                    </span>
                    {notification.deep_link && (
                      <Link
                        href={notification.deep_link}
                        className="text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => !notification.read && markAsRead(notification.id)}
                      >
                        자세히 보기
                      </Link>
                    )}
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        읽음 처리
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
