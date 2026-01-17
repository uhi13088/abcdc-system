'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  EmptyState,
  PageLoading,
  Select,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Alert,
  Card,
  CardContent,
} from '@/components/ui';
import { Building2, Plus, Edit, Trash2, MapPin, Phone, QrCode, Users, Factory } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  allowed_radius: number;
  default_hourly_rate: number;
  qr_code: string;
  created_at: string;
  brand_id: string;
  brands: { id: string; name: string };
  companies: { id: string; name: string };
  // 출퇴근 허용시간
  early_checkin_minutes: number;
  early_checkout_minutes: number;
  // 급여 설정
  pay_day: number;
  pay_period_type: string;
  pay_period_start_day: number | null;
  pay_period_end_day: number | null;
  // 수당 옵션
  allowance_overtime: boolean;
  allowance_night: boolean;
  allowance_holiday: boolean;
  // 운영시간
  opening_time: string;
  closing_time: string;
  // HACCP
  haccp_enabled: boolean;
  // Roasting
  roasting_enabled: boolean;
}

interface Brand {
  id: string;
  name: string;
  company_id: string;
}

// API fetchers
const fetchBrands = async (): Promise<Brand[]> => {
  const res = await fetch('/api/brands');
  if (!res.ok) throw new Error('Failed to fetch brands');
  return res.json();
};

const fetchStores = async (brandId?: string): Promise<Store[]> => {
  const params = new URLSearchParams();
  if (brandId) params.set('brandId', brandId);
  const res = await fetch(`/api/stores?${params}`);
  if (!res.ok) throw new Error('Failed to fetch stores');
  return res.json();
};

function StoresPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialBrandId = searchParams.get('brandId') || '';
  const [brandFilter, setBrandFilter] = useState(initialBrandId);
  const [haccpAddonEnabled, setHaccpAddonEnabled] = useState(false);
  const [roastingAddonEnabled, setRoastingAddonEnabled] = useState(false);

  // Check if company has add-ons enabled
  useEffect(() => {
    async function checkAddons() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.company_id) return;

      // SUPER_ADMIN has access to all addons
      if (userData.role === 'SUPER_ADMIN') {
        setHaccpAddonEnabled(true);
        setRoastingAddonEnabled(true);
        return;
      }

      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select('haccp_addon_enabled, roasting_addon_enabled')
        .eq('company_id', userData.company_id)
        .single();

      if (subscription?.haccp_addon_enabled) {
        setHaccpAddonEnabled(true);
      }
      if (subscription?.roasting_addon_enabled) {
        setRoastingAddonEnabled(true);
      }
    }
    checkAddons();
  }, []);

  // React Query - data fetching with caching
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 30 * 1000,
  });

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores', brandFilter],
    queryFn: () => fetchStores(brandFilter),
    staleTime: 30 * 1000,
  });

  // Dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newStore, setNewStore] = useState({
    name: '',
    brandId: '',
    companyId: '',
    address: '',
    phone: '',
    allowedRadius: 100,
    defaultHourlyRate: 9860,
    haccpEnabled: false,
    roastingEnabled: false,
  });
  const [error, setError] = useState('');

  // QR Dialog
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [selectedQr, setSelectedQr] = useState('');

  // Edit Dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    phone: '',
    allowedRadius: 100,
    defaultHourlyRate: 9860,
    earlyCheckinMinutes: 15,
    earlyCheckoutMinutes: 5,
    payDay: 10,
    payPeriodType: 'previous_month',
    allowanceOvertime: false,
    allowanceNight: false,
    allowanceHoliday: false,
    openingTime: '09:00',
    closingTime: '22:00',
    haccpEnabled: false,
    roastingEnabled: false,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof newStore) => {
      const brand = brands.find((b) => b.id === data.brandId);
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: brand?.company_id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '매장 생성에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setShowNewDialog(false);
      setNewStore({
        name: '',
        brandId: '',
        companyId: '',
        address: '',
        phone: '',
        allowedRadius: 100,
        defaultHourlyRate: 9860,
        haccpEnabled: false,
        roastingEnabled: false,
      });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stores/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '삭제에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editForm }) => {
      const res = await fetch(`/api/stores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '수정에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setShowEditDialog(false);
      setEditStore(null);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleCreateStore = () => {
    // Client-side validation
    if (!newStore.name.trim()) {
      setError('매장명을 입력해주세요');
      return;
    }
    if (!newStore.brandId) {
      setError('브랜드를 선택해주세요');
      return;
    }
    setError('');
    createMutation.mutate(newStore);
  };

  const handleDeleteStore = (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    deleteMutation.mutate(id);
  };

  const openEditDialog = (store: Store) => {
    setEditStore(store);
    setEditForm({
      name: store.name || '',
      address: store.address || '',
      phone: store.phone || '',
      allowedRadius: store.allowed_radius || 100,
      defaultHourlyRate: store.default_hourly_rate || 9860,
      earlyCheckinMinutes: store.early_checkin_minutes || 15,
      earlyCheckoutMinutes: store.early_checkout_minutes || 5,
      payDay: store.pay_day || 10,
      payPeriodType: store.pay_period_type || 'previous_month',
      allowanceOvertime: store.allowance_overtime || false,
      allowanceNight: store.allowance_night || false,
      allowanceHoliday: store.allowance_holiday || false,
      openingTime: store.opening_time?.substring(0, 5) || '09:00',
      closingTime: store.closing_time?.substring(0, 5) || '22:00',
      haccpEnabled: store.haccp_enabled || false,
      roastingEnabled: store.roasting_enabled || false,
    });
    setError('');
    setShowEditDialog(true);
  };

  const handleUpdateStore = () => {
    if (!editStore) return;
    if (!editForm.name.trim()) {
      setError('매장명을 입력해주세요');
      return;
    }
    setError('');
    updateMutation.mutate({ id: editStore.id, data: editForm });
  };

  const openQrDialog = (store: Store) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      JSON.stringify({ storeId: store.id, name: store.name })
    )}`;
    setSelectedQr(qrUrl);
    setShowQrDialog(true);
  };

  const avgHourlyRate = stores.length > 0
    ? Math.round(stores.reduce((sum, s) => sum + (s.default_hourly_rate || 0), 0) / stores.length)
    : 0;

  return (
    <div>
      <Header title="매장 관리" />

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">전체 매장</p>
                  <p className="text-2xl font-bold">{stores.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">전체 브랜드</p>
                  <p className="text-2xl font-bold">{brands.length}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Building2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">평균 시급</p>
                  <p className="text-2xl font-bold">₩{avgHourlyRate.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              options={[
                { value: '', label: '전체 브랜드' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
              ]}
              className="w-40"
            />
          </div>
          <Button onClick={() => setShowNewDialog(true)} disabled={brands.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            매장 등록
          </Button>
        </div>

        {brands.length === 0 && !storesLoading && (
          <Alert variant="info" className="mb-6">
            매장을 등록하려면 먼저 브랜드를 등록해야 합니다.
          </Alert>
        )}

        {storesLoading ? (
          <PageLoading />
        ) : stores.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="매장이 없습니다"
            description={brands.length === 0 ? "먼저 브랜드를 등록해주세요." : "새로운 매장을 등록해보세요."}
            action={
              <Button onClick={() => setShowNewDialog(true)} disabled={brands.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                매장 등록
              </Button>
            }
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>매장명</TableHead>
                  <TableHead>브랜드</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>기본시급</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{store.brands?.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                        {store.address || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <Phone className="h-4 w-4 mr-1 text-gray-400" />
                        {store.phone || '-'}
                      </div>
                    </TableCell>
                    <TableCell>₩{(store.default_hourly_rate || 0).toLocaleString()}</TableCell>
                    <TableCell>{new Date(store.created_at).toLocaleDateString('ko-KR')}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openQrDialog(store)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(store)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteStore(store.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* New Store Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매장 등록</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label required>매장명</Label>
              <Input
                value={newStore.name}
                onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                placeholder="강남점"
                className={`mt-1 ${!newStore.name && error ? 'border-red-500' : ''}`}
              />
              {!newStore.name && error && (
                <p className="text-xs text-red-500 mt-1">매장명을 입력해주세요</p>
              )}
            </div>
            <div>
              <Label required>브랜드</Label>
              <Select
                value={newStore.brandId}
                onChange={(e) => setNewStore({ ...newStore, brandId: e.target.value })}
                options={[
                  { value: '', label: '브랜드를 선택해주세요' },
                  ...brands.map((b) => ({ value: b.id, label: b.name })),
                ]}
                className={`mt-1 ${!newStore.brandId && error ? 'border-red-500' : ''}`}
              />
              {!newStore.brandId && error && (
                <p className="text-xs text-red-500 mt-1">브랜드를 선택해주세요</p>
              )}
            </div>
            <div>
              <Label>주소</Label>
              <Input
                value={newStore.address}
                onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
                placeholder="서울시 강남구..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>연락처</Label>
              <Input
                value={newStore.phone}
                onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })}
                placeholder="02-1234-5678"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>출근 허용 반경 (m)</Label>
                <Input
                  type="number"
                  value={newStore.allowedRadius}
                  onChange={(e) =>
                    setNewStore({ ...newStore, allowedRadius: parseInt(e.target.value) || 100 })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>기본 시급 (원)</Label>
                <Input
                  type="number"
                  value={newStore.defaultHourlyRate}
                  onChange={(e) =>
                    setNewStore({
                      ...newStore,
                      defaultHourlyRate: parseInt(e.target.value) || 9860,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* HACCP 설정 - 애드온 활성화 시에만 표시 */}
            {haccpAddonEnabled && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700">HACCP 매장</p>
                      <p className="text-sm text-green-600">
                        이 매장의 모든 직원에게 HACCP 앱 접근 권한을 부여합니다
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newStore.haccpEnabled}
                    onChange={(e) => setNewStore({ ...newStore, haccpEnabled: e.target.checked })}
                    className="h-5 w-5 text-green-600 rounded"
                  />
                </div>
              </div>
            )}

            {/* Roasting 설정 - 애드온 활성화 시에만 표시 */}
            {roastingAddonEnabled && (
              <div className={haccpAddonEnabled ? "pt-2" : "border-t pt-4 mt-4"}>
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-700">로스팅 매장</p>
                      <p className="text-sm text-amber-600">
                        이 매장의 모든 직원에게 로스팅 앱 접근 권한을 부여합니다
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newStore.roastingEnabled}
                    onChange={(e) => setNewStore({ ...newStore, roastingEnabled: e.target.checked })}
                    className="h-5 w-5 text-amber-600 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreateStore}
              disabled={createMutation.isPending || !newStore.name || !newStore.brandId}
            >
              {createMutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>매장 설정</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">기본 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>매장명</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="강남점"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>연락처</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="02-1234-5678"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>주소</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="서울시 강남구..."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>출근 허용 반경 (m)</Label>
                  <Input
                    type="number"
                    value={editForm.allowedRadius}
                    onChange={(e) => setEditForm({ ...editForm, allowedRadius: parseInt(e.target.value) || 100 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>기본 시급 (원)</Label>
                  <Input
                    type="number"
                    value={editForm.defaultHourlyRate}
                    onChange={(e) => setEditForm({ ...editForm, defaultHourlyRate: parseInt(e.target.value) || 9860 })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 급여 설정 */}
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium text-gray-900">급여 지급일 및 계산 기간</h4>
              <p className="text-sm text-gray-500">매장의 급여 지급일과 계산 기간을 설정합니다.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>매월 지급일</Label>
                  <Select
                    value={editForm.payDay.toString()}
                    onChange={(e) => setEditForm({ ...editForm, payDay: parseInt(e.target.value) })}
                    options={Array.from({ length: 28 }, (_, i) => ({
                      value: (i + 1).toString(),
                      label: `${i + 1}일`,
                    }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>계산 기간 타입</Label>
                  <Select
                    value={editForm.payPeriodType}
                    onChange={(e) => setEditForm({ ...editForm, payPeriodType: e.target.value })}
                    options={[
                      { value: 'previous_month', label: '전월 전체 (전월 1일~말일)' },
                      { value: 'current_month', label: '당월 전체 (당월 1일~말일)' },
                      { value: 'custom', label: '사용자 지정' },
                    ]}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 수당 적용 옵션 */}
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium text-gray-900">수당 적용 옵션</h4>
              <p className="text-sm text-gray-500">이 매장에서 적용할 수당 항목을 선택합니다.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">연장근로수당</p>
                    <p className="text-sm text-gray-500">시급 × 1.5배</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.allowanceOvertime}
                    onChange={(e) => setEditForm({ ...editForm, allowanceOvertime: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">야간근로수당</p>
                    <p className="text-sm text-gray-500">22:00~06:00, 시급 × 0.5배 추가</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.allowanceNight}
                    onChange={(e) => setEditForm({ ...editForm, allowanceNight: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">휴일근로수당</p>
                    <p className="text-sm text-gray-500">시급 × 1.5배</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.allowanceHoliday}
                    onChange={(e) => setEditForm({ ...editForm, allowanceHoliday: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>
              </div>
            </div>

            {/* 매장 운영시간 */}
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium text-gray-900">매장 운영시간</h4>
              <p className="text-sm text-gray-500">근무 스케줄표는 운영시간 기준으로 앞뒤 3시간씩 표시됩니다.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>오픈 시간</Label>
                  <Input
                    type="time"
                    value={editForm.openingTime}
                    onChange={(e) => setEditForm({ ...editForm, openingTime: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>마감 시간</Label>
                  <Input
                    type="time"
                    value={editForm.closingTime}
                    onChange={(e) => setEditForm({ ...editForm, closingTime: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 출퇴근 허용시간 설정 */}
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium text-gray-900">출퇴근 허용시간</h4>
              <p className="text-sm text-gray-500">근무시간 전후의 출퇴근 허용범위를 설정합니다.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>조기출근 허용 (분)</Label>
                  <Input
                    type="number"
                    value={editForm.earlyCheckinMinutes}
                    onChange={(e) => setEditForm({ ...editForm, earlyCheckinMinutes: parseInt(e.target.value) || 15 })}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">근무 시작 {editForm.earlyCheckinMinutes}분 전까지 출근 허용</p>
                </div>
                <div>
                  <Label>조기퇴근 허용 (분)</Label>
                  <Input
                    type="number"
                    value={editForm.earlyCheckoutMinutes}
                    onChange={(e) => setEditForm({ ...editForm, earlyCheckoutMinutes: parseInt(e.target.value) || 5 })}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">근무 종료 {editForm.earlyCheckoutMinutes}분 전부터 퇴근 허용</p>
                </div>
              </div>
            </div>

            {/* HACCP 설정 - 애드온 활성화 시에만 표시 */}
            {haccpAddonEnabled && (
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Factory className="h-5 w-5 text-green-600" />
                  HACCP 설정
                </h4>
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p className="font-medium text-green-700">HACCP 매장으로 지정</p>
                    <p className="text-sm text-green-600">
                      이 매장의 모든 직원에게 HACCP 앱 접근 권한이 자동 부여됩니다
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.haccpEnabled}
                      onChange={(e) => setEditForm({ ...editForm, haccpEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            )}

            {/* Roasting 설정 - 애드온 활성화 시에만 표시 */}
            {roastingAddonEnabled && (
              <div className={haccpAddonEnabled ? "pt-4 space-y-4" : "border-t pt-6 space-y-4"}>
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Factory className="h-5 w-5 text-amber-600" />
                  로스팅 설정
                </h4>
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div>
                    <p className="font-medium text-amber-700">로스팅 매장으로 지정</p>
                    <p className="text-sm text-amber-600">
                      이 매장의 모든 직원에게 로스팅 앱 접근 권한이 자동 부여됩니다
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.roastingEnabled}
                      onChange={(e) => setEditForm({ ...editForm, roastingEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleUpdateStore}
              disabled={updateMutation.isPending || !editForm.name}
            >
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출퇴근 QR 코드</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-6">
            {selectedQr && <img src={selectedQr} alt="QR Code" className="w-64 h-64" />}
          </div>
          <p className="text-center text-sm text-gray-500">
            직원들이 이 QR 코드를 스캔하여 출퇴근할 수 있습니다.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowQrDialog(false)}>
              닫기
            </Button>
            <Button onClick={() => window.print()}>인쇄</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function StoresPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StoresPageContent />
    </Suspense>
  );
}
