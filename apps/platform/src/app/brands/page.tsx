'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Plus, Search, Layers, Building2, MapPin } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  company_name: string;
  category: string;
  stores_count: number;
  status: 'active' | 'inactive';
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setBrands([
      { id: '1', name: '황금올리브', company_name: '맛있는 치킨', category: '치킨', stores_count: 8, status: 'active' },
      { id: '2', name: '크리스피', company_name: '맛있는 치킨', category: '치킨', stores_count: 4, status: 'active' },
      { id: '3', name: '해피브레드', company_name: '행복한 베이커리', category: '베이커리', stores_count: 3, status: 'active' },
      { id: '4', name: '달콤케이크', company_name: '행복한 베이커리', category: '베이커리', stores_count: 2, status: 'active' },
      { id: '5', name: '카페모카 오리지널', company_name: '카페모카 프랜차이즈', category: '카페', stores_count: 20, status: 'active' },
      { id: '6', name: '카페모카 프리미엄', company_name: '카페모카 프랜차이즈', category: '카페', stores_count: 15, status: 'active' },
      { id: '7', name: '든든한밥상', company_name: '든든한 식당', category: '한식', stores_count: 1, status: 'inactive' },
      { id: '8', name: '맛집1호점', company_name: '맛집 프랜차이즈', category: '분식', stores_count: 8, status: 'active' },
    ]);
    setLoading(false);
  }, []);

  const filteredBrands = brands.filter(
    (brand) =>
      brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">브랜드 관리</h1>
          <p className="text-gray-600">모든 회사의 브랜드를 관리합니다</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-5 h-5 mr-2" />
          브랜드 등록
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="브랜드명, 회사명, 카테고리로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBrands.map((brand) => (
          <div key={brand.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                  <p className="text-sm text-gray-500">{brand.category}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                brand.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {brand.status === 'active' ? '활성' : '비활성'}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-500">
                  <Building2 className="w-4 h-4 mr-1" />
                  {brand.company_name}
                </span>
                <span className="flex items-center text-gray-500">
                  <MapPin className="w-4 h-4 mr-1" />
                  {brand.stores_count}개 매장
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
