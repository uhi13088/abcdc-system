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
  RefreshCw, Check, X, ExternalLink, Database, Zap
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
    minimumWage: 9860,
    standardDailyHours: 8,
    standardWeeklyHours: 40,
    overtimeRate: 1.5,
    nightRate: 0.5,
    holidayRate: 1.5,
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

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const supabase = createClient();

    // Fetch company settings
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .single();

    if (company) {
      setCompanySettings({
        name: company.name || '',
        businessNumber: company.business_number || '',
        ceoName: company.ceo_name || '',
        address: company.address || '',
        phone: company.phone || '',
      });
    }

    // Fetch integrations
    const { data: integrationsData } = await supabase
      .from('integrations')
      .select('*');

    if (integrationsData) {
      const newIntegrations = { ...integrations };
      integrationsData.forEach((item: any) => {
        if (item.provider === 'toss_pos') {
          newIntegrations.tossPos = {
            enabled: item.enabled,
            apiKey: item.api_key || '',
            storeId: item.store_id || '',
            connected: item.connected,
          };
        }
        // ... other integrations
      });
      setIntegrations(newIntegrations);
    }
  };

  const handleSaveCompanySettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('companies')
        .upsert({
          name: companySettings.name,
          business_number: companySettings.businessNumber,
          ceo_name: companySettings.ceoName,
          address: companySettings.address,
          phone: companySettings.phone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setMessage({ type: 'success', text: '회사 정보가 저장되었습니다.' });
    } catch (error) {
      setMessage({ type: 'error', text: '저장에 실패했습니다.' });
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

              {/* Kakao Work Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3c-5.5 0-10 3.58-10 8 0 2.88 1.87 5.39 4.69 6.83-.15.57-.51 2.04-.59 2.36-.1.4.15.39.31.28.13-.08 2.07-1.37 2.91-1.93.87.13 1.77.2 2.68.2 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/>
                        </svg>
                        카카오워크 연동
                      </CardTitle>
                      <CardDescription>
                        알림 및 메시지를 카카오워크로 전송합니다.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {integrations.kakaoWork.connected ? (
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
                      id="kakao-enabled"
                      checked={integrations.kakaoWork.enabled}
                      onChange={(e) =>
                        setIntegrations(prev => ({
                          ...prev,
                          kakaoWork: { ...prev.kakaoWork, enabled: e.target.checked }
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="kakao-enabled">연동 활성화</Label>
                  </div>

                  {integrations.kakaoWork.enabled && (
                    <>
                      <div>
                        <Label>Bot API Key</Label>
                        <Input
                          type="password"
                          value={integrations.kakaoWork.apiKey}
                          onChange={(e) =>
                            setIntegrations(prev => ({
                              ...prev,
                              kakaoWork: { ...prev.kakaoWork, apiKey: e.target.value }
                            }))
                          }
                          placeholder="Bot API Key"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleTestConnection('kakao-work')}
                          disabled={testingConnection === 'kakao-work'}
                        >
                          {testingConnection === 'kakao-work' ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-2" />
                          )}
                          연결 테스트
                        </Button>
                        <Button onClick={() => handleSaveIntegration('kakao_work')} disabled={loading}>
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Slack Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/>
                        </svg>
                        Slack 연동
                      </CardTitle>
                      <CardDescription>
                        알림을 Slack 채널로 전송합니다.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {integrations.slack.connected ? (
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
                      id="slack-enabled"
                      checked={integrations.slack.enabled}
                      onChange={(e) =>
                        setIntegrations(prev => ({
                          ...prev,
                          slack: { ...prev.slack, enabled: e.target.checked }
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor="slack-enabled">연동 활성화</Label>
                  </div>

                  {integrations.slack.enabled && (
                    <>
                      <div>
                        <Label>Webhook URL</Label>
                        <Input
                          type="password"
                          value={integrations.slack.webhookUrl}
                          onChange={(e) =>
                            setIntegrations(prev => ({
                              ...prev,
                              slack: { ...prev.slack, webhookUrl: e.target.value }
                            }))
                          }
                          placeholder="https://hooks.slack.com/services/..."
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleTestConnection('slack')}
                          disabled={testingConnection === 'slack'}
                        >
                          {testingConnection === 'slack' ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-2" />
                          )}
                          연결 테스트
                        </Button>
                        <Button onClick={() => handleSaveIntegration('slack')} disabled={loading}>
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

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
                <Alert variant="info">
                  이 설정은 2024년 근로기준법을 기준으로 합니다. 법률이 변경되면 자동으로 업데이트됩니다.
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
                  <div className="space-y-2 text-sm">
                    <p>다음 결제일: 2024년 2월 1일</p>
                    <p>직원 수 제한: 무제한</p>
                    <p>매장 수 제한: 무제한</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-2">
                    <CardContent className="pt-6 text-center">
                      <h4 className="font-semibold">FREE</h4>
                      <p className="text-2xl font-bold mt-2">무료</p>
                      <p className="text-sm text-gray-500 mt-1">최대 5명</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2">
                    <CardContent className="pt-6 text-center">
                      <h4 className="font-semibold">STARTER</h4>
                      <p className="text-2xl font-bold mt-2">₩39,000</p>
                      <p className="text-sm text-gray-500 mt-1">최대 20명</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary">
                    <CardContent className="pt-6 text-center">
                      <h4 className="font-semibold text-primary">PRO</h4>
                      <p className="text-2xl font-bold mt-2">₩99,000</p>
                      <p className="text-sm text-gray-500 mt-1">무제한</p>
                      <span className="inline-block mt-2 text-xs text-primary">현재 플랜</span>
                    </CardContent>
                  </Card>
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
