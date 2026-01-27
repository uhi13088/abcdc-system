'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  Printer,
  ChevronRight,
  Beaker,
  Tag,
} from 'lucide-react';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  shelf_life: number;
  storage_condition: string;
  has_recipe: boolean;
}

interface LabelData {
  product_name: string;
  product_code: string;
  food_type: string;
  net_content: string;
  ingredients_list: string;
  allergens: string[];
  allergen_text: string;
  nutrition_facts: {
    serving_size: number;
    calories: number;
    carbohydrate: number;
    sugar: number;
    protein: number;
    fat: number;
    saturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
  } | null;
  expiry_info: string;
  storage_instructions: string;
  manufacturer_name: string;
  manufacturer_address: string;
  cautions: string[];
  generated_at: string;
  recipe_based: boolean;
  ingredients_count: number;
}

export default function LabelingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 제품 목록 조회
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, recipesRes] = await Promise.all([
        fetch('/api/haccp/products'),
        fetch('/api/haccp/recipes'),
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        let recipesData: { grouped?: Array<{ product_id: string }> } = {};

        if (recipesRes.ok) {
          recipesData = await recipesRes.json();
        }

        // 레시피 있는 제품 표시
        const recipeProductIds = new Set(
          (recipesData.grouped || []).map((r: { product_id: string }) => r.product_id)
        );

        const productsWithRecipe = productsData.map((p: Product) => ({
          ...p,
          has_recipe: recipeProductIds.has(p.id),
        }));

        setProducts(productsWithRecipe);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 라벨 생성
  const generateLabel = async (product: Product) => {
    setSelectedProduct(product);
    setLabelLoading(true);
    setLabelData(null);

    try {
      const response = await fetch(`/api/haccp/products/${product.id}/label`);
      if (response.ok) {
        const data = await response.json();
        setLabelData(data);
        setShowPreview(true);
      } else {
        alert('라벨 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to generate label:', error);
      alert('라벨 생성 중 오류가 발생했습니다.');
    } finally {
      setLabelLoading(false);
    }
  };

  // 인쇄
  const handlePrint = () => {
    window.print();
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const productsWithRecipe = products.filter((p) => p.has_recipe).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/products" className="hover:text-primary">
              제품 관리
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>한글표시사항</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">한글표시사항 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            제품별 라벨 정보를 자동으로 생성하고 관리합니다
          </p>
        </div>
        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">전체 제품</p>
              <p className="text-xl font-bold text-gray-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">레시피 등록됨</p>
              <p className="text-xl font-bold text-green-600">{productsWithRecipe}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">레시피 미등록</p>
              <p className="text-xl font-bold text-orange-600">
                {products.length - productsWithRecipe}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제품명 또는 제품코드로 검색..."
            className="flex-1 outline-none text-sm"
          />
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">
            {searchQuery ? '검색 결과가 없습니다' : '등록된 제품이 없습니다'}
          </p>
          <Link href="/products" className="mt-4 text-blue-600 hover:underline inline-block">
            제품 등록하기
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  제품
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  카테고리
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  레시피
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  유통기한
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  라벨 생성
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{product.category || '-'}</td>
                  <td className="px-6 py-4">
                    {product.has_recipe ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        등록됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                        미등록
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {product.shelf_life ? `${product.shelf_life}일` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => generateLabel(product)}
                      disabled={labelLoading && selectedProduct?.id === product.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {labelLoading && selectedProduct?.id === product.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Tag className="w-4 h-4" />
                      )}
                      라벨 생성
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Label Preview Modal */}
      {showPreview && labelData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-lg font-bold">{labelData.product_name}</h2>
                  <p className="text-sm text-gray-500">한글표시사항 미리보기</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Printer className="w-4 h-4" />
                  인쇄
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Label Preview - Print-friendly */}
              <div className="border-2 border-gray-300 rounded-lg p-6 bg-white print:border-black" id="label-content">
                {/* 제품명 */}
                <div className="text-center border-b-2 border-gray-300 pb-4 mb-4">
                  <h1 className="text-2xl font-bold text-gray-900">{labelData.product_name}</h1>
                  {labelData.food_type && (
                    <p className="text-sm text-gray-600 mt-1">{labelData.food_type}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* 왼쪽: 기본 정보 */}
                  <div className="space-y-4">
                    {/* 내용량 */}
                    {labelData.net_content && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">내용량</h3>
                        <p className="text-sm">{labelData.net_content}</p>
                      </div>
                    )}

                    {/* 원재료명 */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">원재료명</h3>
                      {labelData.ingredients_list ? (
                        <p className="text-sm text-gray-700">{labelData.ingredients_list}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          레시피를 등록하면 자동으로 표시됩니다
                        </p>
                      )}
                      {!labelData.recipe_based && (
                        <p className="text-xs text-orange-500 mt-1">
                          * 레시피 미등록: 원재료 정보가 없습니다
                        </p>
                      )}
                    </div>

                    {/* 알레르기 */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">
                        알레르기 유발물질
                      </h3>
                      {labelData.allergen_text ? (
                        <p className="text-sm font-medium text-orange-600 bg-orange-50 p-2 rounded">
                          {labelData.allergen_text} 함유
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">해당사항 없음</p>
                      )}
                    </div>

                    {/* 유통기한 */}
                    {labelData.expiry_info && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">유통기한</h3>
                        <p className="text-sm">{labelData.expiry_info}</p>
                      </div>
                    )}

                    {/* 보관방법 */}
                    {labelData.storage_instructions && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">보관방법</h3>
                        <p className="text-sm">{labelData.storage_instructions}</p>
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 영양정보 */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">영양정보</h3>
                    {labelData.nutrition_facts ? (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-900 text-white px-3 py-2">
                          <p className="text-lg font-bold">영양성분</p>
                          <p className="text-xs">
                            1회 제공량 {labelData.nutrition_facts.serving_size}g 기준
                          </p>
                        </div>
                        <div className="divide-y text-sm">
                          <div className="flex justify-between px-3 py-2 bg-gray-50">
                            <span className="font-bold">열량</span>
                            <span className="font-bold">
                              {labelData.nutrition_facts.calories}kcal
                            </span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5">
                            <span>탄수화물</span>
                            <span>{labelData.nutrition_facts.carbohydrate}g</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5 pl-6 text-gray-600">
                            <span>당류</span>
                            <span>{labelData.nutrition_facts.sugar}g</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5">
                            <span>단백질</span>
                            <span>{labelData.nutrition_facts.protein}g</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5">
                            <span>지방</span>
                            <span>{labelData.nutrition_facts.fat}g</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5 pl-6 text-gray-600">
                            <span>포화지방</span>
                            <span>{labelData.nutrition_facts.saturated_fat}g</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5 pl-6 text-gray-600">
                            <span>트랜스지방</span>
                            <span>{labelData.nutrition_facts.trans_fat}g</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5">
                            <span>콜레스테롤</span>
                            <span>{labelData.nutrition_facts.cholesterol}mg</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5">
                            <span>나트륨</span>
                            <span>{labelData.nutrition_facts.sodium}mg</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 text-center text-gray-400">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">
                          영양성분 정보를 계산할 수 없습니다.
                          <br />
                          레시피 등록 후 자동 계산됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 하단: 제조원 정보 */}
                <div className="mt-6 pt-4 border-t-2 border-gray-300">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">제조원</h3>
                      <p>{labelData.manufacturer_name || '(회사명)'}</p>
                      {labelData.manufacturer_address && (
                        <p className="text-gray-600 text-xs">{labelData.manufacturer_address}</p>
                      )}
                    </div>
                    {labelData.cautions.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">주의사항</h3>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {labelData.cautions.map((caution, idx) => (
                            <li key={idx}>• {caution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* 생성 정보 */}
                <div className="mt-4 pt-2 border-t text-xs text-gray-400 text-right print:hidden">
                  생성일시: {new Date(labelData.generated_at).toLocaleString('ko-KR')}
                  {labelData.recipe_based && ` | 원료 ${labelData.ingredients_count}종 기반`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #label-content,
          #label-content * {
            visibility: visible;
          }
          #label-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
