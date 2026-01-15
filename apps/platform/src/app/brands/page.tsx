'use client';

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
    const fetchBrands = async () => {
      try {
        const response = await fetch('/api/brands');
        if (response.ok) {
          const data = await response.json();
          setBrands(data.map((b: any) => ({
            id: b.id,
            name: b.name,
            company_name: b.company_name || '알 수 없음',
            category: b.category || '미분류',
            stores_count: b.stores_count || 0,
            status: b.status?.toLowerCase() === 'active' ? 'active' : 'inactive',
          })));
        }
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
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
