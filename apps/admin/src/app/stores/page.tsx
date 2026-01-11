'use client';

import { useState, Suspense } from 'react';
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
import { Building2, Plus, Edit, Trash2, MapPin, Phone, QrCode, Users } from 'lucide-react';

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
  });
  const [error, setError] = useState('');

  // QR Dialog
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [selectedQr, setSelectedQr] = useState('');

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
                        <Button size="sm" variant="ghost">
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
