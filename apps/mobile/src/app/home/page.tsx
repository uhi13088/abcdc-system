'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, Bell, ChevronRight, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { formatTime, formatDate } from '@/lib/utils';

export default function HomePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userName = '홍길동';
  const storeName = '강남점';

  const todaySchedule = {
    start: '09:00',
    end: '18:00',
  };

  const recentNotices = [
    { id: 1, title: '1월 급여 지급 안내', date: '01/10' },
    { id: 2, title: '설 연휴 근무 일정 안내', date: '01/08' },
  ];

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-6 rounded-b-3xl safe-top">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-100 text-sm">{storeName}</p>
            <h1 className="text-xl font-bold">{userName}님, 안녕하세요!</h1>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-lg font-bold">홍</span>
          </div>
        </div>

        {/* Time Card */}
        <div className="bg-white/10 rounded-2xl p-4">
          <div className="text-center">
            <p className="text-primary-100 text-sm">{formatDate(currentTime)}</p>
            <p className="text-4xl font-bold my-2">{formatTime(currentTime)}</p>
            <p className="text-primary-100 text-sm">
              오늘 근무: {todaySchedule.start} - {todaySchedule.end}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <button
            onClick={() => setIsCheckedIn(!isCheckedIn)}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
              isCheckedIn
                ? 'bg-red-500 text-white'
                : 'bg-primary text-white'
            }`}
          >
            {isCheckedIn ? '퇴근하기' : '출근하기'}
          </button>
          {isCheckedIn && (
            <p className="text-center text-sm text-gray-500 mt-2">
              출근 시간: 09:02
            </p>
          )}

          {/* Quick Request Buttons */}
          <div className="flex gap-2 mt-3">
            <Link
              href="/request"
              className="flex-1 py-3 bg-gray-100 rounded-xl text-center font-medium text-gray-700 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              휴가신청
            </Link>
            <Link
              href="/request"
              className="flex-1 py-3 bg-gray-100 rounded-xl text-center font-medium text-gray-700 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              근무신청
            </Link>
          </div>
        </div>
      </div>

      {/* Today's Info */}
      <div className="p-4 space-y-4">
        {/* Schedule Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              오늘 스케줄
            </h2>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">근무시간</span>
            <span className="font-medium">
              {todaySchedule.start} - {todaySchedule.end}
            </span>
          </div>
        </div>

        {/* Notices Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-primary" />
              공지사항
            </h2>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentNotices.map((notice) => (
              <div key={notice.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{notice.title}</span>
                <span className="text-gray-400">{notice.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Hours */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-primary" />
              이번 주 근무
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-primary">32</p>
              <p className="text-xs text-gray-500">근무 시간</p>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-gray-900">4</p>
              <p className="text-xs text-gray-500">근무 일수</p>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-green-500">0</p>
              <p className="text-xs text-gray-500">지각/조퇴</p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
