'use client';

/**
 * 세무대리인 설정 페이지
 * 세무대리인 정보 및 자동 전송 설정 관리
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Send, FileSpreadsheet, History } from 'lucide-react';

const taxAccountantSchema = z.object({
  name: z.string().min(1, '세무대리인 이름을 입력해주세요'),
  businessNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('올바른 이메일을 입력해주세요').optional().or(z.literal('')),
  faxNumber: z.string().optional(),
  transmissionMethod: z.enum(['EMAIL', 'FAX', 'MANUAL']),
  autoSend: z.boolean(),
  sendDay: z.number().min(1).max(28),
  format: z.enum(['EXCEL', 'PDF', 'JSON']),
});

type TaxAccountantFormData = z.infer<typeof taxAccountantSchema>;

interface TransmissionHistory {
  id: string;
  year: number;
  month: number;
  method: string;
  status: string;
  transmitted_at: string;
  file_url?: string;
}

export default function TaxAccountantSettingsPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<TransmissionHistory[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<TaxAccountantFormData>({
    resolver: zodResolver(taxAccountantSchema),
    defaultValues: {
      name: '',
      businessNumber: '',
      phone: '',
      email: '',
      faxNumber: '',
      transmissionMethod: 'EMAIL',
      autoSend: false,
      sendDay: 5,
      format: 'EXCEL',
    },
  });

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        // 현재 사용자의 회사 ID 가져오기
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (!userData?.company_id) return;
        setCompanyId(userData.company_id);

        // 세무대리인 정보 로드
        const { data: taxAccountant } = await supabase
          .from('tax_accountants')
          .select('*')
          .eq('company_id', userData.company_id)
          .single();

        if (taxAccountant) {
          form.reset({
            name: taxAccountant.name || '',
            businessNumber: taxAccountant.business_number || '',
            phone: taxAccountant.phone || '',
            email: taxAccountant.email || '',
            faxNumber: taxAccountant.fax_number || '',
            transmissionMethod: taxAccountant.transmission_method || 'EMAIL',
            autoSend: taxAccountant.auto_send || false,
            sendDay: taxAccountant.send_day || 5,
            format: taxAccountant.format || 'EXCEL',
          });
        }

        // 전송 이력 로드
        const { data: historyData } = await supabase
          .from('tax_transmissions')
          .select('*')
          .eq('company_id', userData.company_id)
          .order('transmitted_at', { ascending: false })
          .limit(12);

        setHistory(historyData || []);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase, form]);

  // 저장
  async function onSubmit(data: TaxAccountantFormData) {
    if (!companyId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: upsertError } = await supabase
        .from('tax_accountants')
        .upsert({
          company_id: companyId,
          name: data.name,
          business_number: data.businessNumber,
          phone: data.phone,
          email: data.email,
          fax_number: data.faxNumber,
          transmission_method: data.transmissionMethod,
          auto_send: data.autoSend,
          send_day: data.sendDay,
          format: data.format,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id',
        });

      if (upsertError) throw upsertError;

      setSuccess('세무대리인 정보가 저장되었습니다.');
    } catch (err) {
      console.error('Save error:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // 즉시 전송
  async function handleSendNow() {
    if (!companyId) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 전월

      const response = await fetch('/api/tax/payroll-report/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          year: month === 0 ? year - 1 : year,
          month: month === 0 ? 12 : month,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '전송 실패');
      }

      setSuccess('급여대장이 전송되었습니다.');

      // 이력 새로고침
      const { data: historyData } = await supabase
        .from('tax_transmissions')
        .select('*')
        .eq('company_id', companyId)
        .order('transmitted_at', { ascending: false })
        .limit(12);

      setHistory(historyData || []);
    } catch (err) {
      console.error('Send error:', err);
      setError((err as Error).message || '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">세무대리인 설정</h1>
        <p className="text-muted-foreground">
          세무대리인 정보를 등록하고 급여대장 자동 전송을 설정합니다.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">설정</TabsTrigger>
          <TabsTrigger value="history">전송 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>세무대리인 정보</CardTitle>
                <CardDescription>
                  급여대장을 전송받을 세무대리인 정보를 입력해주세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">세무대리인 이름 *</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      placeholder="홍길동 세무사"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessNumber">사업자등록번호</Label>
                    <Input
                      id="businessNumber"
                      {...form.register('businessNumber')}
                      placeholder="123-45-67890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      placeholder="02-1234-5678"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      type="email"
                      {...form.register('email')}
                      placeholder="tax@example.com"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="faxNumber">팩스번호</Label>
                    <Input
                      id="faxNumber"
                      {...form.register('faxNumber')}
                      placeholder="02-1234-5679"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>전송 설정</CardTitle>
                <CardDescription>
                  급여대장 전송 방법과 자동 전송 일정을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>전송 방법</Label>
                    <Select
                      value={form.watch('transmissionMethod')}
                      onValueChange={(value) =>
                        form.setValue('transmissionMethod', value as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMAIL">이메일</SelectItem>
                        <SelectItem value="FAX">팩스</SelectItem>
                        <SelectItem value="MANUAL">수동 다운로드</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>파일 형식</Label>
                    <Select
                      value={form.watch('format')}
                      onValueChange={(value) =>
                        form.setValue('format', value as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXCEL">Excel (.xlsx)</SelectItem>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="JSON">JSON (홈택스 형식)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>자동 전송</Label>
                    <p className="text-sm text-muted-foreground">
                      매월 지정한 날짜에 전월 급여대장을 자동으로 전송합니다.
                    </p>
                  </div>
                  <Switch
                    checked={form.watch('autoSend')}
                    onCheckedChange={(checked) =>
                      form.setValue('autoSend', checked)
                    }
                  />
                </div>

                {form.watch('autoSend') && (
                  <div className="space-y-2">
                    <Label htmlFor="sendDay">전송일</Label>
                    <Select
                      value={String(form.watch('sendDay'))}
                      onValueChange={(value) =>
                        form.setValue('sendDay', parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            매월 {day}일
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                저장
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleSendNow}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                즉시 전송
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                전송 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  전송 이력이 없습니다.
                </p>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <FileSpreadsheet className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-medium">
                            {item.year}년 {item.month}월 급여대장
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(item.transmitted_at).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            item.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.status === 'SUCCESS' ? '성공' : '실패'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {item.method === 'EMAIL'
                            ? '이메일'
                            : item.method === 'FAX'
                            ? '팩스'
                            : '수동'}
                        </span>
                        {item.file_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={item.file_url} download>
                              다운로드
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
