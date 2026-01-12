'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Pin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { createClient } from '@/lib/supabase/client';

interface Notice {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

interface ReadNotice {
  notice_id: string;
}

export default function NoticesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readNotices, setReadNotices] = useState<Set<string>>(new Set());
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/auth/login');
          return;
        }

        // Fetch notices
        const { data: noticesData } = await supabase
          .from('notices')
          .select('id, title, content, is_pinned, created_at')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });

        if (noticesData) {
          setNotices(noticesData);
        }

        // Fetch read notices for current user
        const { data: readData } = await supabase
          .from('notice_reads')
          .select('notice_id')
          .eq('user_id', authUser.id);

        if (readData) {
          setReadNotices(new Set(readData.map((r: ReadNotice) => r.notice_id)));
        }
      } catch (error) {
        console.error('Error fetching notices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotices();
  }, [supabase, router]);

  const handleSelectNotice = async (notice: Notice) => {
    setSelectedNotice(notice);

    // Mark as read
    if (!readNotices.has(notice.id)) {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          await supabase
            .from('notice_reads')
            .upsert({ user_id: authUser.id, notice_id: notice.id });

          setReadNotices((prev) => new Set(Array.from(prev).concat(notice.id)));
        }
      } catch (error) {
        console.error('Error marking notice as read:', error);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
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
        <h1 className="text-xl font-bold text-gray-900">공지사항</h1>
      </div>

      {/* Notices List */}
      <div className="p-4 space-y-3">
        {notices.length > 0 ? (
          notices.map((notice) => (
            <button
              key={notice.id}
              onClick={() => handleSelectNotice(notice)}
              className="w-full bg-white rounded-xl p-4 shadow-sm text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {notice.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                    {!readNotices.has(notice.id) && (
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900">{notice.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{notice.content}</p>
                </div>
                <div className="flex items-center ml-4">
                  <span className="text-xs text-gray-400">{formatDate(notice.created_at)}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-1" />
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <p className="text-gray-400">공지사항이 없습니다</p>
          </div>
        )}
      </div>

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {selectedNotice.is_pinned && (
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    고정
                  </span>
                )}
                <span className="text-sm text-gray-500">{formatDate(selectedNotice.created_at)}</span>
              </div>
              <button onClick={() => setSelectedNotice(null)} className="text-gray-400">
                닫기
              </button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedNotice.title}</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedNotice.content}</p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
