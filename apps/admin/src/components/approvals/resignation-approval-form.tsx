'use client';

import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

interface ResignationApprovalFormProps {
  staffId?: string;
  onSubmit: (data: ResignationApprovalData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export interface ResignationApprovalData {
  resignationType: string;
  resignationDate: string;
  reason: string;
  reasonDetail?: string;
  returnItems: ReturnItem[];
  handoverNotes?: string;
  exitInterviewDone: boolean;
  acknowledgement: boolean;
}

interface ReturnItem {
  name: string;
  returned: boolean;
  notes?: string;
}

const RESIGNATION_TYPES = [
  { value: 'VOLUNTARY', label: '자진퇴사', description: '본인 희망에 의한 퇴사' },
  { value: 'RECOMMENDED', label: '권고사직', description: '회사 권고에 의한 퇴사' },
  { value: 'CONTRACT_END', label: '계약만료', description: '근로계약 기간 종료' },
  { value: 'RETIREMENT', label: '정년퇴직', description: '정년 도래에 의한 퇴직' },
];

const RESIGNATION_REASONS = [
  { value: 'PERSONAL', label: '개인 사정' },
  { value: 'HEALTH', label: '건강 문제' },
  { value: 'RELOCATION', label: '이사/거주지 변경' },
  { value: 'CAREER', label: '경력 개발/이직' },
  { value: 'EDUCATION', label: '학업' },
  { value: 'FAMILY', label: '가정 사정' },
  { value: 'WORK_ENVIRONMENT', label: '근무 환경' },
  { value: 'OTHER', label: '기타' },
];

const DEFAULT_RETURN_ITEMS: ReturnItem[] = [
  { name: '사원증/출입카드', returned: false },
  { name: '유니폼/피복', returned: false },
  { name: '회사 비품(키, 사물함 열쇠 등)', returned: false },
  { name: '업무 관련 자료/문서', returned: false },
  { name: '회사 장비(태블릿, 핸드헬드 등)', returned: false },
];

export function ResignationApprovalForm({
  staffId,
  onSubmit,
  onCancel,
  loading = false,
}: ResignationApprovalFormProps) {
  const [resignationType, setResignationType] = useState('VOLUNTARY');
  const [resignationDate, setResignationDate] = useState('');
  const [reason, setReason] = useState('PERSONAL');
  const [reasonDetail, setReasonDetail] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(DEFAULT_RETURN_ITEMS);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [exitInterviewDone, setExitInterviewDone] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState(false);

  // 최소 퇴사일 (오늘로부터 최소 30일 후, 권고사직 제외)
  const minResignationDate = resignationType === 'RECOMMENDED'
    ? new Date().toISOString().split('T')[0]
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const toggleReturnItem = (index: number) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], returned: !updated[index].returned };
      return updated;
    });
  };

  const updateReturnItemNotes = (index: number, notes: string) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], notes };
      return updated;
    });
  };

  const addCustomReturnItem = () => {
    const name = prompt('반납 항목명을 입력하세요');
    if (name) {
      setReturnItems(prev => [...prev, { name, returned: false }]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!resignationDate) {
      alert('최종 근무일을 선택해주세요.');
      return;
    }

    if (!acknowledgement) {
      alert('퇴사 안내사항을 확인해주세요.');
      return;
    }

    onSubmit({
      resignationType,
      resignationDate,
      reason,
      reasonDetail: reasonDetail || undefined,
      returnItems,
      handoverNotes: handoverNotes || undefined,
      exitInterviewDone,
      acknowledgement,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 안내 */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">퇴사 신청 시 유의사항</p>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>퇴사일 최소 30일 전에 신청해주세요 (자진퇴사 시)</li>
            <li>미사용 연차는 퇴직금 정산 시 반영됩니다</li>
            <li>반납 물품은 최종 근무일까지 반납 완료해주세요</li>
          </ul>
        </div>
      </div>

      {/* 퇴사 유형 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          퇴사 유형 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {RESIGNATION_TYPES.map(type => (
            <label
              key={type.value}
              className={`
                flex flex-col p-3 border rounded-lg cursor-pointer transition-colors
                ${resignationType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="resignationType"
                value={type.value}
                checked={resignationType === type.value}
                onChange={(e) => setResignationType(e.target.value)}
                className="sr-only"
              />
              <span className="font-medium">{type.label}</span>
              <span className="text-xs text-gray-500">{type.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 최종 근무일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          최종 근무일 <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={resignationDate}
          onChange={(e) => setResignationDate(e.target.value)}
          min={minResignationDate}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        {resignationType !== 'RECOMMENDED' && (
          <p className="mt-1 text-xs text-gray-500">
            자진퇴사 시 최소 30일 전에 신청해야 합니다
          </p>
        )}
      </div>

      {/* 퇴사 사유 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          퇴사 사유 <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          {RESIGNATION_REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <textarea
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          placeholder="상세 사유를 입력해주세요 (선택)"
          className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
      </div>

      {/* 반납 물품 체크리스트 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          반납 물품 체크리스트
        </label>
        <div className="border rounded-lg divide-y">
          {returnItems.map((item, index) => (
            <div key={index} className="p-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleReturnItem(index)}
                className={`
                  flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                  ${item.returned
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-gray-400'
                  }
                `}
              >
                {item.returned && <Check className="h-4 w-4" />}
              </button>
              <span className={`flex-1 ${item.returned ? 'line-through text-gray-400' : ''}`}>
                {item.name}
              </span>
              <input
                type="text"
                placeholder="비고"
                value={item.notes || ''}
                onChange={(e) => updateReturnItemNotes(index, e.target.value)}
                className="w-32 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCustomReturnItem}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          + 항목 추가
        </button>
      </div>

      {/* 인수인계 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          인수인계 사항
        </label>
        <textarea
          value={handoverNotes}
          onChange={(e) => setHandoverNotes(e.target.value)}
          placeholder="후임자에게 인계할 업무 내용을 기록해주세요"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
        />
      </div>

      {/* 퇴사 면담 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="exitInterview"
          checked={exitInterviewDone}
          onChange={(e) => setExitInterviewDone(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="exitInterview" className="text-sm text-gray-700">
          퇴사 면담 완료
        </label>
      </div>

      {/* 확인 동의 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="acknowledgement"
            checked={acknowledgement}
            onChange={(e) => setAcknowledgement(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            required
          />
          <label htmlFor="acknowledgement" className="text-sm text-gray-700">
            <span className="font-medium">퇴사 안내사항을 확인했습니다.</span>
            <ul className="mt-1 text-gray-500 list-disc list-inside space-y-0.5">
              <li>퇴직금은 최종 근무일로부터 14일 이내 지급됩니다</li>
              <li>4대 보험 자격 상실 신고가 진행됩니다</li>
              <li>미사용 연차 수당이 정산됩니다</li>
              <li>회사 자료 및 정보를 외부에 유출하지 않습니다</li>
            </ul>
          </label>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={loading}
        >
          취소
        </button>
        <button
          type="submit"
          className="px-6 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={loading || !acknowledgement}
        >
          {loading ? '처리 중...' : '퇴사 신청'}
        </button>
      </div>
    </form>
  );
}

export default ResignationApprovalForm;
