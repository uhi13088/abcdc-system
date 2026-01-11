'use client';

import { useState } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';

interface AttendanceRecord {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: 'normal' | 'late' | 'early';
}

export default function AttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState('2024-01');

  const records: AttendanceRecord[] = [
    { date: '01/10 (금)', checkIn: '08:58', checkOut: '18:02', hours: '9시간', status: 'normal' },
    { date: '01/09 (목)', checkIn: '09:05', checkOut: '18:00', hours: '8시간 55분', status: 'late' },
    { date: '01/08 (수)', checkIn: '08:55', checkOut: '18:00', hours: '9시간 5분', status: 'normal' },
    { date: '01/07 (화)', checkIn: '09:00', checkOut: '17:30', hours: '8시간 30분', status: 'early' },
    { date: '01/06 (월)', checkIn: '08:50', checkOut: '18:10', hours: '9시간 20분', status: 'normal' },
  ];

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    const styles = {
      normal: 'bg-green-100 text-green-700',
      late: 'bg-yellow-100 text-yellow-700',
      early: 'bg-orange-100 text-orange-700',
    };
    const labels = {
      normal: '정상',
      late: '지각',
      early: '조퇴',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 safe-top">
        <h1 className="text-xl font-bold text-gray-900">출퇴근 기록</h1>
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="bg-primary rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">1월 근무 현황</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white/20 text-white px-3 py-1 rounded-lg text-sm"
            >
              <option value="2024-01">2024년 1월</option>
              <option value="2023-12">2023년 12월</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">15</p>
              <p className="text-primary-100 text-xs">근무일</p>
            </div>
            <div>
              <p className="text-3xl font-bold">135</p>
              <p className="text-primary-100 text-xs">총 시간</p>
            </div>
            <div>
              <p className="text-3xl font-bold">1</p>
              <p className="text-primary-100 text-xs">지각/조퇴</p>
            </div>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="px-4">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary" />
          출퇴근 기록
        </h2>
        <div className="space-y-3">
          {records.map((record, index) => (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{record.date}</span>
                {getStatusBadge(record.status)}
              </div>
              <div className="grid grid-cols-3 text-sm text-gray-500">
                <div>
                  <p className="text-xs text-gray-400">출근</p>
                  <p className="font-medium text-gray-900">{record.checkIn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">퇴근</p>
                  <p className="font-medium text-gray-900">{record.checkOut}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">근무</p>
                  <p className="font-medium text-gray-900">{record.hours}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
