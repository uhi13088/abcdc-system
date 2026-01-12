'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import {
  Button,
  Input,
  Select,
  Label,
  Alert,
} from '@/components/ui';
import { Send, Copy, Check, MessageSquare, MessageCircle, Link2 } from 'lucide-react';

interface Store {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  salary_type: string;
  salary_amount: number;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
}

const salaryTypeLabels: Record<string, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
};

const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

export default function InviteEmployeePage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    inviteUrl: string;
    sendResults: Record<string, { success: boolean }>;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    storeId: '',
    templateId: '',
    sendMethods: ['kakao', 'sms', 'link'] as string[],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [storesRes, templatesRes] = await Promise.all([
          fetch('/api/stores'),
          fetch('/api/invitation-templates'),
        ]);

        if (storesRes.ok) {
          const storesData = await storesRes.json();
          setStores(Array.isArray(storesData) ? storesData : storesData.data || []);
        }

        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTemplates(templatesData.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleSendMethod = (method: string) => {
    setFormData((prev) => ({
      ...prev,
      sendMethods: prev.sendMethods.includes(method)
        ? prev.sendMethods.filter((m) => m !== method)
        : [...prev.sendMethods, method],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess({
          inviteUrl: result.inviteUrl,
          sendResults: result.sendResults,
        });
      } else {
        setError(result.error || '초대 발송에 실패했습니다.');
      }
    } catch (err) {
      setError('초대 발송에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (success?.inviteUrl) {
      await navigator.clipboard.writeText(success.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSelectedTemplate = () => {
    return templates.find((t) => t.id === formData.templateId);
  };

  const formatWorkDays = (days: number[]) => {
    return days.map((d) => dayLabels[d]).join(', ');
  };

  if (loading) {
    return (
      <div>
        <Header title="직원 초대" />
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // 초대 발송 성공 화면
  if (success) {
    return (
      <div>
        <Header title="직원 초대" />
        <div className="p-6 max-w-xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">초대가 발송되었습니다!</h2>
            <p className="text-gray-600 mb-6">
              {formData.name} ({formData.phone})
            </p>

            <div className="text-left mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">발송 결과</p>
              <div className="space-y-2">
                {success.sendResults.kakao && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4" />
                    <span>카카오톡</span>
                    <span className={success.sendResults.kakao.success ? 'text-green-600' : 'text-red-600'}>
                      {success.sendResults.kakao.success ? '발송 완료' : '발송 실패'}
                    </span>
                  </div>
                )}
                {success.sendResults.sms && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    <span>SMS</span>
                    <span className={success.sendResults.sms.success ? 'text-green-600' : 'text-red-600'}>
                      {success.sendResults.sms.success ? '발송 완료' : '발송 실패'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">초대 링크</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={success.inviteUrl}
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded text-sm"
                />
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">* 유효기간: 7일</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/employees/invitations')}
              >
                초대 현황 보기
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setSuccess(null);
                  setFormData({
                    name: '',
                    phone: '',
                    storeId: formData.storeId,
                    templateId: formData.templateId,
                    sendMethods: ['kakao', 'sms', 'link'],
                  });
                }}
              >
                추가 초대
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="직원 초대" />

      <div className="p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          {error && <Alert variant="error" className="mb-6">{error}</Alert>}

          {/* 초대 정보 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">초대 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>이름</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="이름 입력"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label required>전화번호</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  className="mt-1"
                  required
                />
              </div>
            </div>
            <div>
              <Label required>매장</Label>
              <Select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                options={[
                  { value: '', label: '매장을 선택하세요' },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
                className="mt-1"
                required
              />
            </div>
          </div>

          {/* 템플릿 선택 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">템플릿 선택</h3>
            {templates.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm mb-2">등록된 템플릿이 없습니다.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/employees/templates')}
                >
                  템플릿 만들기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <label
                    key={template.id}
                    className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.templateId === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="template"
                        value={template.id}
                        checked={formData.templateId === template.id}
                        onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-gray-500">{template.description}</div>
                        )}
                        <div className="text-sm text-gray-600 mt-1">
                          {salaryTypeLabels[template.salary_type]} {template.salary_amount.toLocaleString()}원
                          {' | '}
                          {formatWorkDays(template.work_days)} {template.work_start_time}~{template.work_end_time}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 발송 방법 */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2">발송 방법 (복수 선택 가능)</h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => toggleSendMethod('kakao')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors relative ${
                  formData.sendMethods.includes('kakao')
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                {formData.sendMethods.includes('kakao') && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-yellow-600" />
                  </div>
                )}
                <MessageCircle className="h-5 w-5" />
                <span>카카오톡</span>
                <span className="text-xs opacity-60">(준비중)</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSendMethod('sms')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors relative ${
                  formData.sendMethods.includes('sms')
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                {formData.sendMethods.includes('sms') && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                <MessageSquare className="h-5 w-5" />
                <span>SMS</span>
                <span className="text-xs opacity-60">(준비중)</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSendMethod('link')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors relative ${
                  formData.sendMethods.includes('link')
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                {formData.sendMethods.includes('link') && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                )}
                <Link2 className="h-5 w-5" />
                <span>링크 복사</span>
              </button>
            </div>
            <p className="text-xs text-gray-500">* 카카오톡/SMS는 외부 연동 후 사용 가능합니다. 현재는 링크 복사만 동작합니다.</p>
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || !formData.name || !formData.phone || !formData.storeId || formData.sendMethods.length === 0}
            >
              {submitting ? (
                '발송 중...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  초대 발송
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
