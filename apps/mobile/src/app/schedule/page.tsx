'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';

interface ScheduleItem {
  date: number;
  dayOfWeek: string;
  shift: string | null;
  hours: string;
  isToday?: boolean;
}

export default function SchedulePage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());

  const weekSchedule: ScheduleItem[] = [
    { date: 6, dayOfWeek: '월', shift: '오전', hours: '09:00 - 18:00' },
    { date: 7, dayOfWeek: '화', shift: '오전', hours: '09:00 - 18:00' },
    { date: 8, dayOfWeek: '수', shift: '오전', hours: '09:00 - 18:00' },
    { date: 9, dayOfWeek: '목', shift: '오전', hours: '09:00 - 18:00' },
    { date: 10, dayOfWeek: '금', shift: '오전', hours: '09:00 - 18:00', isToday: true },
    { date: 11, dayOfWeek: '토', shift: null, hours: '휴무' },
    { date: 12, dayOfWeek: '일', shift: null, hours: '휴무' },
  ];

  const getShiftColor = (shift: string | null) => {
    if (!shift) return 'bg-gray-100 text-gray-400';
    switch (shift) {
      case '오전':
        return 'bg-blue-100 text-blue-700';
      case '오후':
        return 'bg-orange-100 text-orange-700';
      case '야간':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <h1 className="text-xl font-bold text-gray-900">근무 스케줄</h1>
      </div>

      {/* Week Navigation */}
      <div className="bg-white p-4 flex items-center justify-between border-b border-gray-200">
        <button className="p-2 rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900">2024년 1월 2주차</span>
        <button className="p-2 rounded-full hover:bg-gray-100">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Week Summary */}
      <div className="p-4">
        <div className="bg-primary rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm">이번 주 근무</p>
              <p className="text-2xl font-bold">40시간</p>
            </div>
            <div className="text-right">
              <p className="text-primary-100 text-sm">근무일</p>
              <p className="text-2xl font-bold">5일</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="px-4 space-y-3">
        {weekSchedule.map((item) => (
          <div
            key={item.date}
            className={`bg-white rounded-xl p-4 shadow-sm ${
              item.isToday ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                  item.isToday ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className="text-xs">{item.dayOfWeek}</span>
                  <span className="font-bold">{item.date}</span>
                </div>
                <div className="ml-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getShiftColor(item.shift)}`}>
                    {item.shift || '휴무'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{item.hours}</p>
                {item.shift && (
                  <p className="text-xs text-gray-500">8시간</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 mt-4">
        <div className="bg-white rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">근무 유형</p>
          <div className="flex items-center space-x-4 text-xs">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-blue-100 rounded-full mr-1"></span>
              오전
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-orange-100 rounded-full mr-1"></span>
              오후
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-purple-100 rounded-full mr-1"></span>
              야간
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-gray-100 rounded-full mr-1"></span>
              휴무
            </span>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
