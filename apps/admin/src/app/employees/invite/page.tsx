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
import { Send, Copy, Check, MessageSquare, MessageCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { DEFAULT_MINIMUM_WAGE } from '@abc/shared';

// Kakao SDK type declaration
declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: {
          objectType: string;
          content: {
            title: string;
            description: string;
            imageUrl?: string;
            link: {
              mobileWebUrl: string;
              webUrl: string;
            };
          };
          buttons?: Array<{
            title: string;
            link: {
              mobileWebUrl: string;
              webUrl: string;
            };
          }>;
        }) => void;
      };
    };
  }
}

interface Store {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  store_id: string | null;
  stores: { id: string; name: string } | null;
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
    storeName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [kakaoSent, setKakaoSent] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    storeId: '',
    templateId: '',
    sendMethods: ['link'] as string[],
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

        // sessionStorage에서 폼 데이터 복원
        const savedFormData = sessionStorage.getItem('invite_form_data');
        if (savedFormData) {
          try {
            const parsed = JSON.parse(savedFormData);
            setFormData(parsed);
            sessionStorage.removeItem('invite_form_data');
          } catch (e) {
            console.error('Failed to restore form data:', e);
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const _toggleSendMethod = (method: string) => {
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
        const selectedStore = stores.find(s => s.id === formData.storeId);
        setSuccess({
          inviteUrl: result.inviteUrl,
          storeName: selectedStore?.name || '',
        });
      } else {
        setError(result.error || '초대 생성에 실패했습니다.');
      }
    } catch (_err) {
      setError('초대 생성에 실패했습니다.');
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

  // SMS 딥링크로 문자 앱 열기
  const openSmsApp = () => {
    if (!success?.inviteUrl) return;

    const message = `[${success.storeName}] ${formData.name}님, 직원 등록을 위해 아래 링크를 눌러주세요.\n\n${success.inviteUrl}`;
    const phone = formData.phone.replace(/-/g, '');

    // iOS/Android 모두 지원하는 SMS URL scheme
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;

    window.open(smsUrl, '_self');
    setSmsSent(true);
    setTimeout(() => setSmsSent(false), 3000);
  };

  // 카카오톡 공유
  const shareKakao = async () => {
    if (!success?.inviteUrl) return;

    const shareTitle = `[${success.storeName}] 직원 등록 초대`;
    const shareText = `${formData.name}님, 직원 등록을 위해 아래 링크를 눌러주세요.`;

    // Kakao SDK가 있으면 사용
    if (window.Kakao && window.Kakao.isInitialized()) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: shareTitle,
          description: shareText,
          link: {
            mobileWebUrl: success.inviteUrl,
            webUrl: success.inviteUrl,
          },
        },
        buttons: [
          {
            title: '등록하기',
            link: {
              mobileWebUrl: success.inviteUrl,
              webUrl: success.inviteUrl,
            },
          },
        ],
      });
      setKakaoSent(true);
      setTimeout(() => setKakaoSent(false), 3000);
      return;
    }

    // Web Share API 지원하면 사용 (모바일에서 카카오톡 선택 가능)
    // URL을 text에 직접 포함해야 메시지에 표시됨
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}\n\n${success.inviteUrl}`,
        });
        setKakaoSent(true);
        setTimeout(() => setKakaoSent(false), 3000);
        return;
      } catch (err) {
        // 사용자가 취소한 경우 무시
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // 폴백: 클립보드 복사
    const fullText = `${shareTitle}\n${shareText}\n${success.inviteUrl}`;
    await navigator.clipboard.writeText(fullText);
    setKakaoSent(true);
    setTimeout(() => setKakaoSent(false), 3000);
    alert('메시지가 복사되었습니다.\n카카오톡에서 붙여넣기 해주세요.');
  };

  // 네이티브 공유 (Web Share API)
  const _shareNative = async () => {
    if (!success?.inviteUrl) return;

    const shareTitle = `[${success.storeName}] 직원 등록 초대`;
    const shareText = `${formData.name}님, 직원 등록을 위해 아래 링크를 눌러주세요.`;

    if (navigator.share) {
      try {
        // URL을 text에 직접 포함해야 메시지에 표시됨
        await navigator.share({
          title: shareTitle,
          text: `${shareText}\n\n${success.inviteUrl}`,
        });
      } catch (_err) {
        // 사용자가 취소한 경우 무시
      }
    } else {
      // Web Share API 미지원시 클립보드 복사
      const fullText = `${shareTitle}\n${shareText}\n${success.inviteUrl}`;
      await navigator.clipboard.writeText(fullText);
      alert('메시지가 복사되었습니다.');
    }
  };

  const formatWorkDays = (days: number[]) => {
    return days.map((d) => dayLabels[d]).join(', ');
  };

  // 선택된 매장에 해당하는 템플릿 + 공통 템플릿만 필터링
  const filteredTemplates = templates.filter((template) => {
    if (!formData.storeId) return true; // 매장 미선택 시 전체 표시
    // 해당 매장 템플릿 또는 공통 템플릿
    return template.store_id === formData.storeId || !template.store_id;
  });

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

  // 초대 링크 생성 성공 화면
  if (success) {
    return (
      <div>
        <Header title="직원 초대" />
        <div className="p-6 max-w-xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">초대 링크가 생성되었습니다</h2>
            <p className="text-gray-600 mb-6">
              {formData.name} ({formData.phone})
            </p>

            {/* 공유 버튼들 */}
            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium text-gray-700 text-left">공유 방법 선택</p>

              {/* 카카오톡 공유 */}
              <button
                type="button"
                onClick={shareKakao}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="font-medium">
                  {kakaoSent ? '복사 완료! 카카오톡에서 붙여넣기' : '카카오톡으로 공유'}
                </span>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </button>

              {/* SMS 공유 */}
              <button
                type="button"
                onClick={openSmsApp}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">
                  {smsSent ? 'SMS 앱 열림' : 'SMS로 공유'}
                </span>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </button>
            </div>

            {/* 초대 링크 복사 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2 text-left">초대 링크 직접 복사</p>
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
              <p className="text-xs text-gray-500 mt-2 text-left">* 유효기간: 7일</p>
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
                  setSmsSent(false);
                  setKakaoSent(false);
                  setCopied(false);
                  setFormData({
                    name: '',
                    phone: '',
                    storeId: formData.storeId,
                    templateId: formData.templateId,
                    sendMethods: ['link'],
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
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value, templateId: '' })}
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
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-gray-900">템플릿 선택</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // 현재 폼 데이터를 sessionStorage에 저장
                  sessionStorage.setItem('invite_form_data', JSON.stringify(formData));
                  router.push('/employees/templates');
                }}
              >
                템플릿 관리
              </Button>
            </div>
            {!formData.storeId ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">먼저 매장을 선택해주세요.</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">해당 매장의 템플릿이 없습니다. 템플릿을 먼저 만들어주세요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{template.name}</span>
                          {!template.store_id && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">공통</span>
                          )}
                        </div>
                        {template.description && (
                          <div className="text-sm text-gray-500">{template.description}</div>
                        )}
                        <div className="text-sm text-gray-600 mt-1">
                          {salaryTypeLabels[template.salary_type]} {template.salary_amount.toLocaleString()}원
                          {template.salary_type === 'hourly' && template.salary_amount > 0 && template.salary_amount < DEFAULT_MINIMUM_WAGE && (
                            <span className="inline-flex items-center gap-0.5 text-amber-600 ml-1">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">최저임금 미만</span>
                            </span>
                          )}
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
              disabled={submitting || !formData.name || !formData.phone || !formData.storeId}
            >
              {submitting ? (
                '생성 중...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  초대 링크 생성
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
