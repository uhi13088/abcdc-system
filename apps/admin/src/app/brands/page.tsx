'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Textarea,
} from '@/components/ui';
import { Building2, Plus, Edit, Trash2, Store, Package } from 'lucide-react';
import Link from 'next/link';

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  company_id: string;
  created_at: string;
}

interface StoreItem {
  id: string;
  brand_id: string;
}

// API fetchers
const fetchBrands = async (): Promise<Brand[]> => {
  const res = await fetch('/api/brands');
  if (!res.ok) throw new Error('Failed to fetch brands');
  return res.json();
};

const fetchStores = async (): Promise<StoreItem[]> => {
  const res = await fetch('/api/stores');
  if (!res.ok) throw new Error('Failed to fetch stores');
  return res.json();
};

export default function BrandsPage() {
  const queryClient = useQueryClient();

  // React Query - data fetching with caching
  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: fetchStores,
    staleTime: 30 * 1000,
  });

  // Dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [newBrand, setNewBrand] = useState({
    name: '',
    description: '',
    logoUrl: '',
  });
  const [error, setError] = useState('');


  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof newBrand) => {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          logoUrl: data.logoUrl || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '브랜드 생성에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      closeDialog();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof newBrand }) => {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          logoUrl: data.logoUrl || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '브랜드 수정에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      closeDialog();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '삭제에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Helpers
  const getStoreCount = (brandId: string) => {
    return stores.filter((s) => s.brand_id === brandId).length;
  };

  const handleCreateBrand = () => {
    setError('');
    createMutation.mutate(newBrand);
  };

  const handleUpdateBrand = () => {
    if (!editingBrand) return;
    setError('');
    updateMutation.mutate({ id: editingBrand.id, data: newBrand });
  };

  const handleDeleteBrand = (id: string) => {
    const storeCount = getStoreCount(id);
    if (storeCount > 0) {
      alert(`이 브랜드에 ${storeCount}개의 매장이 있습니다. 먼저 매장을 삭제해주세요.`);
      return;
    }
    if (!confirm('정말 삭제하시겠습니까?')) return;
    deleteMutation.mutate(id);
  };

  const openEditDialog = (brand: Brand) => {
    setEditingBrand(brand);
    setNewBrand({
      name: brand.name,
      description: brand.description || '',
      logoUrl: brand.logo_url || '',
    });
    setError('');
  };

  const closeDialog = () => {
    setShowNewDialog(false);
    setEditingBrand(null);
    setNewBrand({ name: '', description: '', logoUrl: '' });
    setError('');
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <Header title="브랜드 관리" />

      <div className="p-6">
        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Package className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">계층 구조</p>
              <p className="text-sm text-blue-700 mt-1">
                회사 → <strong>브랜드</strong> → 매장 → 직원
              </p>
              <p className="text-xs text-blue-600 mt-1">
                하나의 회사에서 여러 브랜드를 운영할 수 있으며, 각 브랜드 아래에 여러 매장을 등록할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">전체 브랜드</p>
                  <p className="text-2xl font-bold">{brands.length}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">전체 매장</p>
                  <p className="text-2xl font-bold">{stores.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">브랜드당 평균 매장</p>
                  <p className="text-2xl font-bold">
                    {brands.length > 0 ? (stores.length / brands.length).toFixed(1) : 0}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Building2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setShowNewDialog(true)} >
            <Plus className="h-4 w-4 mr-2" />
            브랜드 등록
          </Button>
        </div>

        {brandsLoading ? (
          <PageLoading />
        ) : brands.length === 0 ? (
          <EmptyState
            icon={Package}
            title="브랜드가 없습니다"
            description="새로운 브랜드를 등록해보세요. 브랜드를 먼저 등록해야 매장을 등록할 수 있습니다."
            action={
              <Button onClick={() => setShowNewDialog(true)} >
                <Plus className="h-4 w-4 mr-2" />
                브랜드 등록
              </Button>
            }
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>브랜드명</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>매장 수</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <div className="flex items-center">
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="w-8 h-8 rounded-full mr-3 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                            <Package className="w-4 h-4 text-purple-600" />
                          </div>
                        )}
                        <span className="font-medium">{brand.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {brand.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/stores?brandId=${brand.id}`}>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200">
                          <Store className="w-3 h-3 mr-1" />
                          {getStoreCount(brand.id)}개 매장
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {new Date(brand.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(brand)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBrand(brand.id)}
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

      {/* New/Edit Brand Dialog */}
      <Dialog open={showNewDialog || !!editingBrand} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? '브랜드 수정' : '브랜드 등록'}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label required>브랜드명</Label>
              <Input
                value={newBrand.name}
                onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                placeholder="예: 맛있는 치킨"
                className="mt-1"
              />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea
                value={newBrand.description}
                onChange={(e) => setNewBrand({ ...newBrand, description: e.target.value })}
                placeholder="브랜드에 대한 간단한 설명"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label>로고 URL</Label>
              <Input
                value={newBrand.logoUrl}
                onChange={(e) => setNewBrand({ ...newBrand, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                이미지 URL을 입력하세요. 나중에 파일 업로드 기능이 추가될 예정입니다.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={closeDialog}>
              취소
            </Button>
            <Button
              onClick={editingBrand ? handleUpdateBrand : handleCreateBrand}
              disabled={isSubmitting || !newBrand.name.trim()}
            >
              {isSubmitting ? '처리 중...' : editingBrand ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
