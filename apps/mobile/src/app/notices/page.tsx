'use client';

import { useState } from 'react';
import { Bell, ChevronRight, Pin } from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';

interface Notice {
  id: number;
  title: string;
  content: string;
  date: string;
  isPinned: boolean;
  isRead: boolean;
}

export default function NoticesPage() {
  const [notices] = useState<Notice[]>([
    {
      id: 1,
      title: '1월 급여 지급 안내',
      content: '1월분 급여가 1월 25일에 지급될 예정입니다.',
      date: '01/10',
      isPinned: true,
      isRead: false,
    },
    {
      id: 2,
      title: '설 연휴 근무 일정 안내',
      content: '설 연휴 기간 근무 일정을 확인해 주세요.',
      date: '01/08',
      isPinned: true,
      isRead: true,
    },
    {
      id: 3,
      title: 'HACCP 위생 교육 안내',
      content: '1월 15일 위생 교육이 진행됩니다.',
      date: '01/05',
      isPinned: false,
      isRead: true,
    },
    {
      id: 4,
      title: '신메뉴 출시 안내',
      content: '1월 신메뉴가 출시되었습니다. 메뉴 교육을 확인해 주세요.',
      date: '01/02',
      isPinned: false,
      isRead: true,
    },
    {
      id: 5,
      title: '새해 인사',
      content: '2024년 새해 복 많이 받으세요!',
      date: '01/01',
      isPinned: false,
      isRead: true,
    },
  ]);

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <h1 className="text-xl font-bold text-gray-900">공지사항</h1>
      </div>

      {/* Notices List */}
      <div className="p-4 space-y-3">
        {notices.map((notice) => (
          <button
            key={notice.id}
            onClick={() => setSelectedNotice(notice)}
            className="w-full bg-white rounded-xl p-4 shadow-sm text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  {notice.isPinned && (
                    <Pin className="w-4 h-4 text-primary" />
                  )}
                  {!notice.isRead && (
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </div>
                <h3 className="font-medium text-gray-900">{notice.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{notice.content}</p>
              </div>
              <div className="flex items-center ml-4">
                <span className="text-xs text-gray-400">{notice.date}</span>
                <ChevronRight className="w-5 h-5 text-gray-400 ml-1" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {selectedNotice.isPinned && (
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    고정
                  </span>
                )}
                <span className="text-sm text-gray-500">{selectedNotice.date}</span>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="text-gray-400"
              >
                닫기
              </button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedNotice.title}</h2>
            <p className="text-gray-700 leading-relaxed">{selectedNotice.content}</p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
