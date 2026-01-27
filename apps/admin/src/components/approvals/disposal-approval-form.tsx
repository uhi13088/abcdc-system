'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Camera, X } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface DisposalApprovalFormProps {
  onSubmit: (data: DisposalApprovalData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export interface DisposalApprovalData {
  category: string;
  itemName: string;
  quantity: number;
  unit: string;
  estimatedValue: number;
  reason: string;
  reasonDetail?: string;
  disposalMethod: string;
  photos: File[];
  notes?: string;
}

const CATEGORIES = [
  { value: 'FOOD', label: '식재료' },
  { value: 'CONSUMABLES', label: '소모품' },
  { value: 'EQUIPMENT', label: '설비/장비' },
  { value: 'PACKAGING', label: '포장재' },
  { value: 'OTHER', label: '기타' },
];

const DISPOSAL_REASONS = [
  { value: 'EXPIRED', label: '유통기한 만료' },
  { value: 'DAMAGED', label: '파손' },
  { value: 'DEFECTIVE', label: '불량' },
  { value: 'OBSOLETE', label: '노후화/폐기' },
  { value: 'QUALITY', label: '품질 저하' },
  { value: 'OTHER', label: '기타' },
];

const DISPOSAL_METHODS = [
  { value: 'DISPOSE', label: '폐기', description: '일반/음식물 쓰레기 처리' },
  { value: 'DONATE', label: '기부', description: '푸드뱅크 등 기부' },
  { value: 'RECYCLE', label: '재활용', description: '재활용 처리' },
  { value: 'RETURN', label: '반품', description: '업체 반품' },
];

export function DisposalApprovalForm({
  onSubmit,
  onCancel,
  loading = false,
}: DisposalApprovalFormProps) {
  const [category, setCategory] = useState('FOOD');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('개');
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [reason, setReason] = useState('EXPIRED');
  const [reasonDetail, setReasonDetail] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('DISPOSE');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      alert('사진은 최대 5장까지 첨부 가능합니다.');
      return;
    }

    setPhotos(prev => [...prev, ...files]);

    // 미리보기 URL 생성
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setPhotoUrls(prev => [...prev, url]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(photoUrls[index]);
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemName.trim()) {
      alert('품목명을 입력해주세요.');
      return;
    }

    if (photos.length === 0) {
      alert('폐기 대상 사진을 1장 이상 첨부해주세요.');
      return;
    }

    onSubmit({
      category,
      itemName,
      quantity,
      unit,
      estimatedValue,
      reason,
      reasonDetail: reasonDetail || undefined,
      disposalMethod,
      photos,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 분류 */}
      <div>
        <Label required className="block text-gray-700 mb-2">분류</Label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* 품목명 */}
      <div>
        <Label required className="block text-gray-700 mb-2">품목명</Label>
        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="폐기 대상 품목명"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      {/* 수량 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label required className="block text-gray-700 mb-2">수량</Label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            min="1"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            단위
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="개">개</option>
            <option value="박스">박스</option>
            <option value="kg">kg</option>
            <option value="L">L</option>
            <option value="팩">팩</option>
          </select>
        </div>
      </div>

      {/* 추정 가치 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          추정 가치 (원가 기준)
        </label>
        <div className="relative">
          <input
            type="number"
            value={estimatedValue || ''}
            onChange={(e) => setEstimatedValue(parseInt(e.target.value) || 0)}
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">원</span>
        </div>
      </div>

      {/* 폐기 사유 */}
      <div>
        <Label required className="block text-gray-700 mb-2">폐기 사유</Label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          {DISPOSAL_REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {reason === 'OTHER' && (
          <input
            type="text"
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="기타 사유를 입력해주세요"
            className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        )}
      </div>

      {/* 처리 방법 */}
      <div>
        <Label required className="block text-gray-700 mb-2">처리 방법</Label>
        <div className="grid grid-cols-2 gap-3">
          {DISPOSAL_METHODS.map(method => (
            <label
              key={method.value}
              className={`
                flex flex-col p-3 border rounded-lg cursor-pointer transition-colors
                ${disposalMethod === method.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="disposalMethod"
                value={method.value}
                checked={disposalMethod === method.value}
                onChange={(e) => setDisposalMethod(e.target.value)}
                className="sr-only"
              />
              <span className="font-medium">{method.label}</span>
              <span className="text-xs text-gray-500">{method.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 폐기 대상 사진 */}
      <div>
        <Label required className="block text-gray-700 mb-2">
          폐기 대상 사진
          <span className="text-gray-500 font-normal ml-1">(최대 5장)</span>
        </Label>

        <div className="grid grid-cols-5 gap-3">
          {photoUrls.map((url, index) => (
            <div key={index} className="relative aspect-square">
              <Image
                src={url}
                alt={`폐기 대상 ${index + 1}`}
                fill
                className="object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {photos.length < 5 && (
            <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Camera className="h-6 w-6 text-gray-400" />
              <span className="text-xs text-gray-500 mt-1">추가</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoAdd}
                className="hidden"
                multiple
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          폐기 대상을 명확히 보여주는 사진을 첨부해주세요
        </p>
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          비고
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="추가 참고사항"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={2}
        />
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
          className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? '처리 중...' : '승인 요청'}
        </button>
      </div>
    </form>
  );
}

export default DisposalApprovalForm;
