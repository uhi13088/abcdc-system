'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';

interface PurchaseItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface PurchaseApprovalFormProps {
  onSubmit: (data: PurchaseApprovalData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export interface PurchaseApprovalData {
  category: string;
  items: PurchaseItem[];
  totalAmount: number;
  vendor: string;
  purpose: string;
  urgency: 'URGENT' | 'NORMAL' | 'SCHEDULED';
  requestedDeliveryDate?: string;
  quotationFile?: File;
  notes?: string;
}

const CATEGORIES = [
  { value: 'CONSUMABLES', label: '소모품' },
  { value: 'INGREDIENTS', label: '식자재' },
  { value: 'EQUIPMENT', label: '설비' },
  { value: 'MAINTENANCE', label: '유지보수' },
  { value: 'OTHER', label: '기타' },
];

const URGENCY_OPTIONS = [
  { value: 'URGENT', label: '긴급', description: '즉시 필요' },
  { value: 'NORMAL', label: '일반', description: '1주 이내' },
  { value: 'SCHEDULED', label: '정기', description: '정기 발주' },
];

export function PurchaseApprovalForm({
  onSubmit,
  onCancel,
  loading = false,
}: PurchaseApprovalFormProps) {
  const [category, setCategory] = useState('CONSUMABLES');
  const [items, setItems] = useState<PurchaseItem[]>([
    { name: '', quantity: 1, unitPrice: 0, subtotal: 0 },
  ]);
  const [vendor, setVendor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [urgency, setUrgency] = useState<'URGENT' | 'NORMAL' | 'SCHEDULED'>('NORMAL');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // 소계 자동 계산
      if (field === 'quantity' || field === 'unitPrice') {
        updated[index].subtotal = updated[index].quantity * updated[index].unitPrice;
      }

      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(item => item.name.trim() && item.quantity > 0);
    if (validItems.length === 0) {
      alert('품목을 1개 이상 입력해주세요.');
      return;
    }

    onSubmit({
      category,
      items: validItems,
      totalAmount,
      vendor,
      purpose,
      urgency,
      requestedDeliveryDate: requestedDeliveryDate || undefined,
      quotationFile: quotationFile || undefined,
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

      {/* 품목 목록 */}
      <div>
        <Label required className="block text-gray-700 mb-2">품목</Label>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="품목명"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <input
                type="number"
                placeholder="수량"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <input
                type="number"
                placeholder="단가"
                min="0"
                value={item.unitPrice || ''}
                onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                className="w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <div className="w-28 px-3 py-2 bg-gray-100 rounded-lg text-right">
                {item.subtotal.toLocaleString()}원
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                disabled={items.length === 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          + 품목 추가
        </button>
      </div>

      {/* 합계 */}
      <div className="flex justify-end items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <span className="font-medium text-gray-700">총액</span>
        <span className="text-2xl font-bold text-blue-600">
          {totalAmount.toLocaleString()}원
        </span>
      </div>

      {/* 업체 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          업체
        </label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="구매 업체명"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 구매 목적 */}
      <div>
        <Label required className="block text-gray-700 mb-2">구매 목적</Label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="구매 목적을 입력해주세요"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          required
        />
      </div>

      {/* 긴급도 */}
      <div>
        <Label required className="block text-gray-700 mb-2">긴급도</Label>
        <div className="grid grid-cols-3 gap-3">
          {URGENCY_OPTIONS.map(option => (
            <label
              key={option.value}
              className={`
                flex flex-col p-3 border rounded-lg cursor-pointer transition-colors
                ${urgency === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="urgency"
                value={option.value}
                checked={urgency === option.value}
                onChange={(e) => setUrgency(e.target.value as typeof urgency)}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-gray-500">{option.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 희망 납품일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          희망 납품일
        </label>
        <input
          type="date"
          value={requestedDeliveryDate}
          onChange={(e) => setRequestedDeliveryDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 견적서 첨부 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          견적서
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setQuotationFile(e.target.files?.[0] || null)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">PDF, JPG, PNG 파일 (최대 10MB)</p>
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

export default PurchaseApprovalForm;
