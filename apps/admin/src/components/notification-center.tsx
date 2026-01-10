'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, X, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Notification {
  id: string;
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  title: string;
  body: string;
  deep_link?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

interface NotificationCenterProps {
  userId?: string;
}

const categoryColors: Record<string, string> = {
  APPROVAL: 'bg-blue-100 text-blue-800',
  SCHEDULE: 'bg-green-100 text-green-800',
  SALARY: 'bg-yellow-100 text-yellow-800',
  CONTRACT: 'bg-purple-100 text-purple-800',
  HACCP: 'bg-red-100 text-red-800',
  SYSTEM: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  LOW: 'border-l-gray-300',
  NORMAL: 'border-l-blue-400',
  HIGH: 'border-l-orange-400',
  CRITICAL: 'border-l-red-500',
};

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications?limit=20');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // 30초마다 새로고침
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });

      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      const deleted = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (deleted && !deleted.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead([notification.id]);
    }

    if (notification.deep_link) {
      window.location.href = notification.deep_link;
    }
  };

  return (
    <div className="relative">
      {/* 알림 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="알림"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 패널 */}
      {isOpen && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 패널 */}
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] bg-white rounded-lg shadow-xl border z-50 flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">알림</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    모두 읽음
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* 알림 목록 */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p>알림이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`
                        p-4 hover:bg-gray-50 cursor-pointer transition-colors
                        border-l-4 ${priorityColors[notification.priority]}
                        ${!notification.read ? 'bg-blue-50/50' : ''}
                      `}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[notification.category] || categoryColors.SYSTEM}`}>
                              {notification.category}
                            </span>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full" />
                            )}
                          </div>
                          <h4 className="font-medium text-gray-900 truncate">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {notification.body}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {notification.deep_link && (
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                          )}
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead([notification.id]);
                              }}
                              className="p-1 rounded hover:bg-gray-200"
                              title="읽음 처리"
                            >
                              <Check className="h-4 w-4 text-gray-500" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 rounded hover:bg-gray-200"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 */}
            {notifications.length > 0 && (
              <div className="p-3 border-t text-center">
                <a
                  href="/notifications"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  모든 알림 보기
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// 알림 아이템 독립 컴포넌트
export function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onClick,
}: {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: Notification) => void;
}) {
  return (
    <div
      className={`
        p-4 hover:bg-gray-50 cursor-pointer transition-colors
        border-l-4 ${priorityColors[notification.priority]}
        ${!notification.read ? 'bg-blue-50/50' : ''}
      `}
      onClick={() => onClick?.(notification)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[notification.category] || categoryColors.SYSTEM}`}>
              {notification.category}
            </span>
            {!notification.read && (
              <span className="w-2 h-2 bg-blue-600 rounded-full" />
            )}
          </div>
          <h4 className="font-medium text-gray-900 truncate">
            {notification.title}
          </h4>
          <p className="text-sm text-gray-600 line-clamp-2">
            {notification.body}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: ko,
            })}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {!notification.read && onMarkRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              className="p-1 rounded hover:bg-gray-200"
              title="읽음 처리"
            >
              <Check className="h-4 w-4 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
              className="p-1 rounded hover:bg-gray-200"
              title="삭제"
            >
              <Trash2 className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationCenter;
