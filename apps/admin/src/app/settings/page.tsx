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
  RefreshCw, Check, X, ExternalLink, Database, Zap, Upload, ImageIcon, AlertTriangle, Info
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

  // Labor law settings
  const [laborSettings, setLaborSettings] = useState({
    minimumWage: 10030, // 2025년 최저임금
    standardDailyHours: 8,
    standardWeeklyHours: 40,
    overtimeRate: 1.5,
    nightRate: 0.5,
    holidayRate: 1.5,
  });

  // Check if minimum wage needs update (every January)
  const [showWageReminder, setShowWageReminder] = useState(false);

  useEffect(() => {
    // Show reminder in January
    const now = new Date();
    if (now.getMonth() === 0) { // January
      setShowWageReminder(true);
    }
  }, []);

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
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveCompanySettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      // Get user's current company_id
      const { data: userData } = await supabase
        .from('users')
        .select('id, company_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData) throw new Error('사용자 정보를 찾을 수 없습니다.');

      const companyData = {
        name: companySettings.name,
        business_number: companySettings.businessNumber || null,
        ceo_name: companySettings.ceoName || null,
        address: companySettings.address || null,
        phone: companySettings.phone || null,
        updated_at: new Date().toISOString(),
      };

      if (userData.company_id) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', userData.company_id);

        if (error) throw error;
      } else {
        // Create new company and link to user
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            ...companyData,
            status: 'ACTIVE',
          })
          .select()
          .single();

        if (createError) throw createError;

        // Link company to user
        const { error: updateError } = await supabase
          .from('users')
          .update({ company_id: newCompany.id })
          .eq('id', userData.id);

        if (updateError) throw updateError;
      }

      setMessage({ type: 'success', text: '회사 정보가 저장되었습니다.' });
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
      const supabase = createClient();
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          email_notifications: notificationSettings.emailNotifications,
          push_notifications: notificationSettings.pushNotifications,
          sms_notifications: notificationSettings.smsNotifications,
          attendance_alerts: notificationSettings.attendanceAlerts,
          approval_alerts: notificationSettings.approvalAlerts,
          salary_alerts: notificationSettings.salaryAlerts,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setMessage({ type: 'success', text: '알림 설정이 저장되었습니다.' });
    } catch (error) {
      setMessage({ type: 'error', text: '저장에 실패했습니다.' });
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
      const supabase = createClient();
      let data: any = { provider, updated_at: new Date().toISOString() };

      if (provider === 'toss_pos') {
        data = {
          ...data,
          enabled: integrations.tossPos.enabled,
          api_key: integrations.tossPos.apiKey,
          store_id: integrations.tossPos.storeId,
        };
      } else if (provider === 'kakao_work') {
        data = {
          ...data,
          enabled: integrations.kakaoWork.enabled,
          api_key: integrations.kakaoWork.apiKey,
        };
      } else if (provider === 'slack') {
        data = {
          ...data,
          enabled: integrations.slack.enabled,
          webhook_url: integrations.slack.webhookUrl,
        };
      }

      const { error } = await supabase
        .from('integrations')
        .upsert(data, { onConflict: 'provider' });

      if (error) throw error;
      setMessage({ type: 'success', text: '연동 설정이 저장되었습니다.' });
    } catch (error) {
      setMessage({ type: 'error', text: '저장에 실패했습니다.' });
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
              {/* POS Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        토스 POS 연동
                      </CardTitle>
                      <CardDescription>
                        매출 데이터를 자동으로 동기화합니다.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {integrations.tossPos.connected ? (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <Check className="h-4 w-4" /> 연결됨
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <X className="h-4 w-4" /> 미연결
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="toss-enabled"
                      checked={integrations.tossPos.enabled}
                      onChange={(e) =>
                        setIntegrations(prev => ({
                          ...prev,
                          tossPos: { ...prev.tossPos, enabled: e.target.checked }
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="toss-enabled">연동 활성화</Label>
                  </div>

                  {integrations.tossPos.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={integrations.tossPos.apiKey}
                            onChange={(e) =>
                              setIntegrations(prev => ({
                                ...prev,
                                tossPos: { ...prev.tossPos, apiKey: e.target.value }
                              }))
                            }
                            placeholder="sk_live_..."
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Store ID</Label>
                          <Input
                            value={integrations.tossPos.storeId}
                            onChange={(e) =>
                              setIntegrations(prev => ({
                                ...prev,
                                tossPos: { ...prev.tossPos, storeId: e.target.value }
                              }))
                            }
                            placeholder="store_..."
                            className="mt-1"
                          />
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
                            <Zap className="h-4 w-4 mr-2" />
                          )}
                          연결 테스트
                        </Button>
                        <Button onClick={() => handleSaveIntegration('toss_pos')} disabled={loading}>
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </Button>
                        <a
                          href="https://developers.tosspayments.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-blue-600 hover:underline ml-auto"
                        >
                          API 문서 <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </>
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
                      { name: '직원', table: 'employees' },
                      { name: '출퇴근', table: 'attendance' },
                      { name: '스케줄', table: 'schedules' },
                      { name: '급여', table: 'salaries' },
                      { name: '승인요청', table: 'approvals' },
                      { name: '공지사항', table: 'notices' },
                      { name: '메시지', table: 'messages' },
                      { name: 'HACCP', table: 'haccp_records' },
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
                <CardTitle>근로기준 설정</CardTitle>
                <CardDescription>
                  급여 계산에 사용되는 근로기준법 관련 설정입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {showWageReminder && (
                  <Alert variant="warning" className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">최저임금 확인 필요</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        새해가 시작되었습니다. 최저임금이 변경되었는지 확인해주세요.
                        <a
                          href="https://www.minimumwage.go.kr"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 underline font-medium"
                        >
                          최저임금위원회 바로가기 →
                        </a>
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowWageReminder(false)}
                      >
                        확인 완료
                      </Button>
                    </div>
                  </Alert>
                )}
                <Alert variant="info">
                  <Info className="h-4 w-4 mr-2 inline" />
                  이 설정은 2025년 근로기준법을 기준으로 합니다. 최저임금: ₩10,030/시간
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>최저시급 (원)</Label>
                    <Input
                      type="number"
                      value={laborSettings.minimumWage}
                      onChange={(e) =>
                        setLaborSettings({
                          ...laborSettings,
                          minimumWage: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                      disabled
                    />
                  </div>
                  <div>
                    <Label>1일 소정근로시간</Label>
                    <Input
                      type="number"
                      value={laborSettings.standardDailyHours}
                      className="mt-1"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>주당 소정근로시간</Label>
                    <Input
                      type="number"
                      value={laborSettings.standardWeeklyHours}
                      className="mt-1"
                      disabled
                    />
                  </div>
                  <div>
                    <Label>연장근로 할증률</Label>
                    <Input
                      type="text"
                      value={`${laborSettings.overtimeRate * 100}%`}
                      className="mt-1"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>야간근로 할증률</Label>
                    <Input
                      type="text"
                      value={`${laborSettings.nightRate * 100}%`}
                      className="mt-1"
                      disabled
                    />
                  </div>
                  <div>
                    <Label>휴일근로 할증률</Label>
                    <Input
                      type="text"
                      value={`${laborSettings.holidayRate * 100}%`}
                      className="mt-1"
                      disabled
                    />
                  </div>
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
                      <h3 className="text-lg font-semibold">PRO 플랜</h3>
                      <p className="text-sm text-gray-500">월 99,000원</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      활성
                    </span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <p>다음 결제일: 2025년 2월 1일</p>
                    <p>직원 수 제한: 무제한</p>
                    <p>매장 수 제한: 무제한</p>
                  </div>
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
                  <Card className="border-2 hover:border-gray-300 cursor-pointer transition-colors">
                    <CardContent className="pt-6 text-center">
                      <h4 className="font-semibold">FREE</h4>
                      <p className="text-2xl font-bold mt-2">무료</p>
                      <p className="text-sm text-gray-500 mt-1">최대 5명</p>
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        다운그레이드
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2 hover:border-gray-300 cursor-pointer transition-colors">
                    <CardContent className="pt-6 text-center">
                      <h4 className="font-semibold">STARTER</h4>
                      <p className="text-2xl font-bold mt-2">₩39,000</p>
                      <p className="text-sm text-gray-500 mt-1">최대 20명</p>
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        다운그레이드
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary">
                    <CardContent className="pt-6 text-center">
                      <h4 className="font-semibold text-primary">PRO</h4>
                      <p className="text-2xl font-bold mt-2">₩99,000</p>
                      <p className="text-sm text-gray-500 mt-1">무제한</p>
                      <Button size="sm" className="mt-4 w-full" disabled>
                        현재 플랜
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-2 text-red-600">구독 취소</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    구독을 취소하면 다음 결제일부터 FREE 플랜으로 전환됩니다.
                    현재 결제 기간이 끝날 때까지 PRO 기능을 계속 사용할 수 있습니다.
                  </p>
                  <Button variant="destructive" size="sm">
                    구독 취소
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
