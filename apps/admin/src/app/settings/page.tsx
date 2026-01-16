'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Alert,
  ButtonLoading,
} from '@/components/ui';
import {
  Save, Building2, Bell, Shield, CreditCard, User, Link2,
  RefreshCw, Check, X, ExternalLink, Database, Zap, Info
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Company settings
  const [companySettings, setCompanySettings] = useState({
    name: '',
    businessNumber: '',
    ceoName: '',
    address: '',
    phone: '',
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    attendanceAlerts: true,
    approvalAlerts: true,
    salaryAlerts: true,
  });


  // Integration settings
  const [integrations, setIntegrations] = useState({
    tossPos: {
      enabled: false,
      apiKey: '',
      storeId: '',
      connected: false,
    },
    kakaoWork: {
      enabled: false,
      apiKey: '',
      connected: false,
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      connected: false,
    },
    googleCalendar: {
      enabled: false,
      connected: false,
    },
  });

  // Subscription settings (실제 데이터)
  const [subscription, setSubscription] = useState<{
    planName: string;
    planTier: string;
    price: number;
    status: string;
    currentPeriodEnd: string | null;
    maxEmployees: number | null;
    maxStores: number | null;
    currentEmployees: number;
    currentStores: number;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const supabase = createClient();

      // Get current user info first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('auth_id', user.id)
        .single();

      // If user has a company, fetch company info
      if (userData?.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name, business_number, ceo_name, address, phone')
          .eq('id', userData.company_id)
          .single();

        if (companyData) {
          setCompanySettings({
            name: companyData.name || '',
            businessNumber: companyData.business_number || '',
            ceoName: companyData.ceo_name || '',
            address: companyData.address || '',
            phone: companyData.phone || '',
          });
        }

        // Get current employee and store counts
        const { count: employeeCount } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', userData.company_id)
          .eq('status', 'ACTIVE');

        const { count: storeCount } = await supabase
          .from('stores')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', userData.company_id);

        // TODO: company_subscriptions table needs to be created
        // For now, use default FREE tier
        {
          // Default to FREE tier
          setSubscription({
            planName: 'FREE',
            planTier: 'FREE',
            price: 0,
            status: 'ACTIVE',
            currentPeriodEnd: null,
            maxEmployees: 5,
            maxStores: 1,
            currentEmployees: employeeCount || 0,
            currentStores: storeCount || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveCompanySettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (!companySettings.name) {
        throw new Error('회사명은 필수입니다.');
      }

      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companySettings.name,
          businessNumber: companySettings.businessNumber,
          ceoName: companySettings.ceoName,
          address: companySettings.address,
          phone: companySettings.phone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      setMessage({ type: 'success', text: result.message || '회사 정보가 저장되었습니다.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '저장에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications: notificationSettings.emailNotifications,
          pushNotifications: notificationSettings.pushNotifications,
          smsNotifications: notificationSettings.smsNotifications,
          attendanceAlerts: notificationSettings.attendanceAlerts,
          approvalAlerts: notificationSettings.approvalAlerts,
          salaryAlerts: notificationSettings.salaryAlerts,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      setMessage({ type: 'success', text: result.message || '알림 설정이 저장되었습니다.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '저장에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (provider: string) => {
    setTestingConnection(provider);

    try {
      const response = await fetch(`/api/integrations/${provider}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          provider === 'toss-pos'
            ? { apiKey: integrations.tossPos.apiKey, storeId: integrations.tossPos.storeId }
            : {}
        ),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `${provider} 연결 성공!` });
        // Update connection status
        if (provider === 'toss-pos') {
          setIntegrations(prev => ({
            ...prev,
            tossPos: { ...prev.tossPos, connected: true }
          }));
        }
      } else {
        setMessage({ type: 'error', text: result.message || '연결 실패' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '연결 테스트 중 오류가 발생했습니다.' });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSaveIntegration = async (provider: string) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let settings: Record<string, unknown> = {};

      if (provider === 'toss_pos') {
        settings = {
          api_key: integrations.tossPos.apiKey,
          store_id: integrations.tossPos.storeId,
        };
      } else if (provider === 'kakao_work') {
        settings = {
          api_key: integrations.kakaoWork.apiKey,
        };
      } else if (provider === 'slack') {
        settings = {
          webhook_url: integrations.slack.webhookUrl,
        };
      }

      const response = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          enabled: provider === 'toss_pos' ? integrations.tossPos.enabled
            : provider === 'kakao_work' ? integrations.kakaoWork.enabled
            : provider === 'slack' ? integrations.slack.enabled
            : false,
          settings,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      setMessage({ type: 'success', text: result.message || '연동 설정이 저장되었습니다.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '저장에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header title="설정" />

      <div className="p-6">
        {message.text && (
          <Alert
            variant={message.type === 'error' ? 'error' : 'success'}
            className="mb-6"
          >
            {message.text}
          </Alert>
        )}

        <Tabs defaultValue="company">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="company">
              <Building2 className="h-4 w-4 mr-2" />
              회사 정보
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Link2 className="h-4 w-4 mr-2" />
              연동/API
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              알림
            </TabsTrigger>
            <TabsTrigger value="labor">
              <Shield className="h-4 w-4 mr-2" />
              근로기준
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <CreditCard className="h-4 w-4 mr-2" />
              구독
            </TabsTrigger>
            <TabsTrigger value="account">
              <User className="h-4 w-4 mr-2" />
              계정
            </TabsTrigger>
          </TabsList>

          {/* Company Settings */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>회사 정보</CardTitle>
                <CardDescription>
                  회사의 기본 정보를 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>회사명</Label>
                    <Input
                      value={companySettings.name}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, name: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>사업자등록번호</Label>
                    <Input
                      value={companySettings.businessNumber}
                      onChange={(e) =>
                        setCompanySettings({
                          ...companySettings,
                          businessNumber: e.target.value,
                        })
                      }
                      placeholder="000-00-00000"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>대표자명</Label>
                    <Input
                      value={companySettings.ceoName}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, ceoName: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>연락처</Label>
                    <Input
                      value={companySettings.phone}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, phone: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>주소</Label>
                  <Input
                    value={companySettings.address}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, address: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="pt-4">
                  <Button onClick={handleSaveCompanySettings} disabled={loading}>
                    {loading ? <ButtonLoading /> : <Save className="h-4 w-4 mr-2" />}
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations / API Settings */}
          <TabsContent value="integrations">
            <div className="space-y-6">
              {/* POS Integration - OAuth 방식 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        토스 POS 연동
                      </CardTitle>
                      <CardDescription>
                        토스 POS를 연결하면 매출이 자동으로 집계됩니다.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {integrations.tossPos.connected ? (
                        <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                          <Check className="h-4 w-4" /> 연결됨
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          <X className="h-4 w-4" /> 미연결
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {integrations.tossPos.connected ? (
                    // 연결된 상태
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">T</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-green-900">토스 POS 연결됨</p>
                            <p className="text-sm text-green-700">매출 데이터가 자동으로 동기화됩니다.</p>
                            <p className="text-xs text-green-600 mt-1">마지막 동기화: 방금 전</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleTestConnection('toss-pos')}
                          disabled={testingConnection === 'toss-pos'}
                        >
                          {testingConnection === 'toss-pos' ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          지금 동기화
                        </Button>
                        <Button
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm('토스 POS 연결을 해제하시겠습니까?')) {
                              setIntegrations(prev => ({
                                ...prev,
                                tossPos: { ...prev.tossPos, connected: false, enabled: false }
                              }));
                            }
                          }}
                        >
                          연결 해제
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 연결 안 된 상태
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">T</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-blue-900">토스 POS를 사용하시나요?</p>
                            <p className="text-sm text-blue-700 mt-1">
                              버튼 하나로 간편하게 연결하세요. 매출이 자동으로 집계됩니다.
                            </p>
                            <ul className="text-xs text-blue-600 mt-2 space-y-1">
                              <li>✓ 일별/시간대별 매출 자동 수집</li>
                              <li>✓ 카드/현금 매출 구분</li>
                              <li>✓ 손익계산서 자동 생성</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <Button
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-lg"
                        onClick={() => {
                          // OAuth 플로우 시작
                          window.location.href = '/api/integrations/toss-pos/authorize';
                        }}
                      >
                        <div className="h-6 w-6 bg-white rounded mr-3 flex items-center justify-center">
                          <span className="text-blue-500 font-bold text-sm">T</span>
                        </div>
                        토스로 연결하기
                      </Button>
                      <p className="text-xs text-gray-500 text-center">
                        토스 계정으로 로그인하면 자동으로 연결됩니다. API Key 입력 필요 없음!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Kakao Work Integration - Hidden for now
              <Card>
                ...카카오워크 연동 (추후 지원 예정)
              </Card>
              */}

              {/* Slack Integration - Hidden for now
              <Card>
                ...Slack 연동 (추후 지원 예정)
              </Card>
              */}

              {/* Realtime Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    실시간 동기화 상태
                  </CardTitle>
                  <CardDescription>
                    Supabase Realtime을 통한 실시간 데이터 동기화 상태입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: '직원', table: 'users' },
                      { name: '출퇴근', table: 'attendances' },
                      { name: '스케줄', table: 'schedules' },
                      { name: '급여', table: 'salaries' },
                      { name: '승인요청', table: 'approval_requests' },
                      { name: '공지사항', table: 'notices' },
                      { name: '계약', table: 'contracts' },
                      { name: 'HACCP', table: 'haccp_checklists' },
                    ].map((item) => (
                      <div key={item.table} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    * 모든 데이터는 Supabase Realtime을 통해 실시간으로 동기화됩니다.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>알림 설정</CardTitle>
                <CardDescription>
                  알림 수신 방법과 항목을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-4">알림 채널</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">이메일 알림</p>
                        <p className="text-sm text-gray-500">이메일로 알림을 받습니다.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailNotifications}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            emailNotifications: e.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">푸시 알림</p>
                        <p className="text-sm text-gray-500">앱에서 푸시 알림을 받습니다.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.pushNotifications}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            pushNotifications: e.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">SMS 알림</p>
                        <p className="text-sm text-gray-500">문자로 알림을 받습니다.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.smsNotifications}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            smsNotifications: e.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">알림 항목</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">출퇴근 알림</p>
                        <p className="text-sm text-gray-500">지각, 조퇴, 결근 등의 알림</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.attendanceAlerts}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            attendanceAlerts: e.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">승인 알림</p>
                        <p className="text-sm text-gray-500">휴가, 구매 등 승인 요청 알림</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.approvalAlerts}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            approvalAlerts: e.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">급여 알림</p>
                        <p className="text-sm text-gray-500">급여 계산, 지급 관련 알림</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.salaryAlerts}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            salaryAlerts: e.target.checked,
                          })
                        }
                        className="h-5 w-5"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveNotificationSettings} disabled={loading}>
                    {loading ? <ButtonLoading /> : <Save className="h-4 w-4 mr-2" />}
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Labor Law Settings */}
          <TabsContent value="labor">
            <Card>
              <CardHeader>
                <CardTitle>근로기준 현황</CardTitle>
                <CardDescription>
                  플랫폼에서 관리하는 근로기준법 설정입니다. 급여 계산에 자동 적용됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 전년도 대비 변경사항 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    2025년 변경사항
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-blue-100">
                      <span className="text-blue-800">최저시급</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 line-through">₩9,860</span>
                        <span className="text-blue-600">→</span>
                        <span className="font-semibold text-blue-900">₩10,030</span>
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">+1.7%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-blue-100">
                      <span className="text-blue-800">건강보험료율</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 line-through">3.495%</span>
                        <span className="text-blue-600">→</span>
                        <span className="font-semibold text-blue-900">3.545%</span>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">+0.05%p</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-blue-800">장기요양보험료율</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 line-through">12.27%</span>
                        <span className="text-blue-600">→</span>
                        <span className="font-semibold text-blue-900">12.81%</span>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">+0.54%p</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-3">
                    * 시행일: 2025년 1월 1일 | 플랫폼에서 자동 관리됩니다
                  </p>
                </div>

                {/* 현재 적용 중인 설정 */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">현재 적용 중인 설정</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">최저시급</p>
                      <p className="text-xl font-bold text-gray-900">₩10,030</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">1일 소정근로시간</p>
                      <p className="text-xl font-bold text-gray-900">8시간</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">주 소정근로시간</p>
                      <p className="text-xl font-bold text-gray-900">40시간</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">연장근로 할증</p>
                      <p className="text-xl font-bold text-gray-900">150%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">야간근로 할증</p>
                      <p className="text-xl font-bold text-gray-900">50%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">휴일근로 할증</p>
                      <p className="text-xl font-bold text-gray-900">150%</p>
                    </div>
                  </div>
                </div>

                {/* 4대보험 요율 */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">4대보험 요율 (근로자 부담분)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">국민연금</p>
                      <p className="text-xl font-bold text-gray-900">4.5%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">건강보험</p>
                      <p className="text-xl font-bold text-gray-900">3.545%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">장기요양보험</p>
                      <p className="text-xl font-bold text-gray-900">12.81%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">고용보험</p>
                      <p className="text-xl font-bold text-gray-900">0.9%</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * 장기요양보험은 건강보험료의 12.81%입니다
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Settings */}
          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>구독 관리</CardTitle>
                <CardDescription>
                  현재 구독 플랜과 결제 정보를 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{subscription?.planName || 'FREE'} 플랜</h3>
                      <p className="text-sm text-gray-500">
                        {subscription?.price ? `월 ${subscription.price.toLocaleString()}원` : '무료'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      subscription?.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : subscription?.status === 'EXPIRED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription?.status === 'ACTIVE' ? '활성' :
                       subscription?.status === 'EXPIRED' ? '만료' :
                       subscription?.status || '활성'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <p>다음 결제일: {subscription?.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                      : '-'}</p>
                    <p>직원 수: {subscription?.currentEmployees || 0}명 / {subscription?.maxEmployees ? `${subscription.maxEmployees}명` : '무제한'}</p>
                    <p>매장 수: {subscription?.currentStores || 0}개 / {subscription?.maxStores ? `${subscription.maxStores}개` : '무제한'}</p>
                  </div>
                  {/* 사용량 경고 */}
                  {subscription?.maxEmployees && subscription.currentEmployees >= subscription.maxEmployees * 0.9 && (
                    <Alert className="mb-4 bg-yellow-50 border-yellow-200">
                      <Info className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm text-yellow-800">
                        직원 수가 제한의 90%에 도달했습니다. 업그레이드를 고려해 주세요.
                      </p>
                    </Alert>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      결제 수단 변경
                    </Button>
                    <Button variant="outline" size="sm">
                      결제 내역
                    </Button>
                  </div>
                </div>

                <h4 className="font-medium mb-4">플랜 선택</h4>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className={`border-2 cursor-pointer transition-colors ${subscription?.planTier === 'FREE' ? 'border-primary' : 'hover:border-gray-300'}`}>
                    <CardContent className="pt-6 text-center">
                      <h4 className={`font-semibold ${subscription?.planTier === 'FREE' ? 'text-primary' : ''}`}>FREE</h4>
                      <p className="text-2xl font-bold mt-2">무료</p>
                      <p className="text-sm text-gray-500 mt-1">최대 5명</p>
                      <Button
                        variant={subscription?.planTier === 'FREE' ? 'default' : 'outline'}
                        size="sm"
                        className="mt-4 w-full"
                        disabled={subscription?.planTier === 'FREE'}
                      >
                        {subscription?.planTier === 'FREE' ? '현재 플랜' : '다운그레이드'}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className={`border-2 cursor-pointer transition-colors ${subscription?.planTier === 'STARTER' ? 'border-primary' : 'hover:border-gray-300'}`}>
                    <CardContent className="pt-6 text-center">
                      <h4 className={`font-semibold ${subscription?.planTier === 'STARTER' ? 'text-primary' : ''}`}>STARTER</h4>
                      <p className="text-2xl font-bold mt-2">₩39,000</p>
                      <p className="text-sm text-gray-500 mt-1">최대 20명</p>
                      <Button
                        variant={subscription?.planTier === 'STARTER' ? 'default' : 'outline'}
                        size="sm"
                        className="mt-4 w-full"
                        disabled={subscription?.planTier === 'STARTER'}
                      >
                        {subscription?.planTier === 'STARTER' ? '현재 플랜' :
                         subscription?.planTier === 'PRO' ? '다운그레이드' : '업그레이드'}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className={`border-2 cursor-pointer transition-colors ${subscription?.planTier === 'PRO' ? 'border-primary' : 'hover:border-gray-300'}`}>
                    <CardContent className="pt-6 text-center">
                      <h4 className={`font-semibold ${subscription?.planTier === 'PRO' ? 'text-primary' : ''}`}>PRO</h4>
                      <p className="text-2xl font-bold mt-2">₩99,000</p>
                      <p className="text-sm text-gray-500 mt-1">무제한</p>
                      <Button
                        variant={subscription?.planTier === 'PRO' ? 'default' : 'outline'}
                        size="sm"
                        className="mt-4 w-full"
                        disabled={subscription?.planTier === 'PRO'}
                      >
                        {subscription?.planTier === 'PRO' ? '현재 플랜' : '업그레이드'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-2 text-red-600">구독 취소</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    구독을 취소하면 다음 결제일부터 FREE 플랜으로 전환됩니다.
                    현재 결제 기간이 끝날 때까지 {subscription?.planTier || 'PRO'} 기능을 계속 사용할 수 있습니다.
                  </p>
                  <Button variant="destructive" size="sm" disabled={subscription?.planTier === 'FREE'}>
                    {subscription?.planTier === 'FREE' ? '무료 플랜 사용중' : '구독 취소'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Settings */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>계정 설정</CardTitle>
                <CardDescription>
                  로그인 및 보안 설정을 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-4">비밀번호 변경</h4>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <Label>현재 비밀번호</Label>
                      <Input type="password" className="mt-1" />
                    </div>
                    <div>
                      <Label>새 비밀번호</Label>
                      <Input type="password" className="mt-1" />
                    </div>
                    <div>
                      <Label>새 비밀번호 확인</Label>
                      <Input type="password" className="mt-1" />
                    </div>
                    <Button>비밀번호 변경</Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4 text-red-600">위험 구역</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
                  </p>
                  <Button variant="destructive">계정 삭제</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
