'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, ChevronDown, ChevronRight, Edit2, Trash2,
  Package, Beaker, Save, AlertTriangle, Search
} from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  code: string;
  name: string;
}

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface RecipeIngredient {
  id?: string;
  component_name?: string;
  material_code?: string;
  material_name: string;
  amount: number;
  unit: string;
  amount_per_unit?: number;
}

interface GroupedRecipe {
  product_id: string | null;
  semi_product_id: string | null;
  product_name: string;
  batch_size: number;
  production_qty: number;
  ingredients: RecipeIngredient[];
}

export default function RecipesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [semiProducts, setSemiProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groupedRecipes, setGroupedRecipes] = useState<GroupedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<GroupedRecipe | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<{
    product_type: 'product' | 'semi_product';
    product_id: string;
    product_name: string;
    batch_size: number;
    production_qty: number;
    ingredients: RecipeIngredient[];
  }>({
    product_type: 'product',
    product_id: '',
    product_name: '',
    batch_size: 1,
    production_qty: 0,
    ingredients: [],
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch data
  const fetchProducts = useCallback(async () => {
    try {
      const [productsRes, semiProductsRes, materialsRes] = await Promise.all([
        fetch('/api/haccp/products'),
        fetch('/api/haccp/semi-products'),
        fetch('/api/haccp/materials'),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data);
      }
      if (semiProductsRes.ok) {
        const data = await semiProductsRes.json();
        setSemiProducts(data);
      }
      if (materialsRes.ok) {
        const data = await materialsRes.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Failed to fetch base data:', error);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/haccp/recipes');
      if (response.ok) {
        const data = await response.json();
        setGroupedRecipes(data.grouped || []);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchRecipes();
  }, [fetchProducts, fetchRecipes]);

  // Toggle expand
  const toggleExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Open edit modal
  const openEditModal = (recipe: GroupedRecipe) => {
    setEditingRecipe(recipe);
    setFormData({
      product_type: recipe.semi_product_id ? 'semi_product' : 'product',
      product_id: recipe.product_id || recipe.semi_product_id || '',
      product_name: recipe.product_name,
      batch_size: recipe.batch_size || 1,
      production_qty: recipe.production_qty || 0,
      ingredients: recipe.ingredients.map(ing => ({
        ...ing,
        component_name: ing.component_name || '',
      })),
    });
    setShowModal(true);
  };

  // Open new modal
  const openNewModal = () => {
    setEditingRecipe(null);
    setFormData({
      product_type: 'product',
      product_id: '',
      product_name: '',
      batch_size: 1,
      production_qty: 0,
      ingredients: [{ material_name: '', amount: 0, unit: 'g' }],
    });
    setShowModal(true);
  };

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    const productType = formData.product_type;
    const list = productType === 'product' ? products : semiProducts;
    const selected = list.find(p => p.id === productId);

    setFormData(prev => ({
      ...prev,
      product_id: productId,
      product_name: selected?.name || '',
    }));
  };

  // Add ingredient row
  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { material_name: '', amount: 0, unit: 'g' }],
    }));
  };

  // Remove ingredient row
  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  // Update ingredient
  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  // Select material for ingredient
  const selectMaterial = (index: number, materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      setFormData(prev => ({
        ...prev,
        ingredients: prev.ingredients.map((ing, i) =>
          i === index ? {
            ...ing,
            material_code: material.code,
            material_name: material.name,
            unit: material.unit || 'g',
          } : ing
        ),
      }));
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_id && !formData.product_name) {
      alert('제품을 선택하거나 제품명을 입력해주세요.');
      return;
    }

    if (formData.ingredients.length === 0 || formData.ingredients.every(ing => !ing.material_name)) {
      alert('최소 하나 이상의 원료를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        product_id: formData.product_type === 'product' ? formData.product_id : null,
        semi_product_id: formData.product_type === 'semi_product' ? formData.product_id : null,
        product_name: formData.product_name,
        batch_size: formData.batch_size,
        production_qty: formData.production_qty,
        ingredients: formData.ingredients.filter(ing => ing.material_name),
      };

      const response = await fetch('/api/haccp/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        fetchRecipes();
      } else {
        const error = await response.json();
        alert(error.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save recipe:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (recipe: GroupedRecipe) => {
    if (!confirm(`"${recipe.product_name}" 레시피를 삭제하시겠습니까?`)) return;

    try {
      const params = new URLSearchParams();
      if (recipe.product_id) {
        params.append('product_id', recipe.product_id);
      } else if (recipe.semi_product_id) {
        params.append('semi_product_id', recipe.semi_product_id);
      }

      const response = await fetch(`/api/haccp/recipes?${params}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchRecipes();
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  };

  // Filter recipes
  const filteredRecipes = groupedRecipes.filter(recipe =>
    recipe.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.ingredients.some(ing =>
      ing.material_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Calculate total amount
  const calculateTotal = (ingredients: RecipeIngredient[]) => {
    return ingredients.reduce((sum, ing) => sum + (ing.amount || 0), 0);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/products" className="hover:text-primary">제품 관리</Link>
            <span>/</span>
            <span>레시피 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">레시피 관리</h1>
          <p className="mt-1 text-sm text-gray-500">제품별 원료 배합표를 관리합니다</p>
        </div>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          레시피 등록
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="제품명 또는 원료명으로 검색..."
            className="flex-1 outline-none text-sm"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">등록된 레시피</p>
              <p className="text-xl font-bold text-gray-900">{groupedRecipes.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 원료 항목</p>
              <p className="text-xl font-bold text-gray-900">
                {groupedRecipes.reduce((sum, r) => sum + r.ingredients.length, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">레시피 없는 제품</p>
              <p className="text-xl font-bold text-purple-600">
                {products.length - groupedRecipes.filter(r => r.product_id).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">
            {searchTerm ? '검색 결과가 없습니다' : '등록된 레시피가 없습니다'}
          </p>
          <button
            onClick={openNewModal}
            className="mt-4 text-blue-600 hover:underline"
          >
            레시피 등록하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecipes.map((recipe) => {
            const key = recipe.product_id || recipe.semi_product_id || recipe.product_name;
            const isExpanded = expandedProducts.has(key);

            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <button
                  onClick={() => toggleExpand(key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900">{recipe.product_name}</h3>
                      <p className="text-sm text-gray-500">
                        {recipe.semi_product_id ? '반제품' : '제품'} · {recipe.ingredients.length}개 원료
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">배치 기준</p>
                      <p className="font-medium">{calculateTotal(recipe.ingredients).toLocaleString()}g</p>
                    </div>
                    {recipe.production_qty > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">생산수량</p>
                        <p className="font-medium">{recipe.production_qty}개</p>
                      </div>
                    )}
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(recipe)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(recipe)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">구성</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">원료코드</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">원료명</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">배합량</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">비율</th>
                          {recipe.production_qty > 0 && (
                            <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">개당 소요량</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {recipe.ingredients.map((ing, idx) => {
                          const total = calculateTotal(recipe.ingredients);
                          const ratio = total > 0 ? (ing.amount / total) * 100 : 0;

                          return (
                            <tr key={ing.id || idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {ing.component_name || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {ing.material_code || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {ing.material_name}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {ing.amount.toLocaleString()} {ing.unit}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-500">
                                {ratio.toFixed(1)}%
                              </td>
                              {recipe.production_qty > 0 && (
                                <td className="px-4 py-2 text-sm text-right text-blue-600">
                                  {ing.amount_per_unit?.toFixed(2) || (ing.amount / recipe.production_qty).toFixed(2)} {ing.unit}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 font-medium">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm text-gray-700">합계</td>
                          <td className="px-4 py-2 text-sm text-right">
                            {calculateTotal(recipe.ingredients).toLocaleString()} g
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-500">100%</td>
                          {recipe.production_qty > 0 && <td></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recipe Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingRecipe ? '레시피 수정' : '레시피 등록'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              {/* Product Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제품 유형</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, product_type: 'product', product_id: '' }))}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.product_type === 'product'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      제품
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, product_type: 'semi_product', product_id: '' }))}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.product_type === 'semi_product'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      반제품
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제품 선택</label>
                  <select
                    value={formData.product_id}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">직접 입력</option>
                    {(formData.product_type === 'product' ? products : semiProducts).map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제품명 *</label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">배치 기준</label>
                  <input
                    type="number"
                    value={formData.batch_size}
                    onChange={(e) => setFormData(prev => ({ ...prev, batch_size: parseFloat(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">생산수량 (개)</label>
                  <input
                    type="number"
                    value={formData.production_qty}
                    onChange={(e) => setFormData(prev => ({ ...prev, production_qty: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                    placeholder="배치당 생산 개수"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">원료 배합표</label>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    원료 추가
                  </button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-700 w-28">구성명</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">원료 선택</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-700 w-32">원료명</th>
                        <th className="px-3 py-2 text-right text-sm font-medium text-gray-700 w-24">배합량</th>
                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-20">단위</th>
                        <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {formData.ingredients.map((ing, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={ing.component_name || ''}
                              onChange={(e) => updateIngredient(idx, 'component_name', e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded"
                              placeholder="예: Base"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              onChange={(e) => selectMaterial(idx, e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded"
                            >
                              <option value="">원료 선택...</option>
                              {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={ing.material_name}
                              onChange={(e) => updateIngredient(idx, 'material_name', e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded"
                              placeholder="원료명"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={ing.amount}
                              onChange={(e) => updateIngredient(idx, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border rounded text-right"
                              min="0"
                              step="0.001"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={ing.unit}
                              onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="mL">mL</option>
                              <option value="L">L</option>
                              <option value="ea">ea</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeIngredient(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {formData.ingredients.length > 0 && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-sm font-medium text-gray-700">합계</td>
                          <td className="px-3 py-2 text-sm font-bold text-right">
                            {calculateTotal(formData.ingredients).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm text-center">g</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {formData.production_qty > 0 && formData.ingredients.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">개당 소요량 계산</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {formData.ingredients.filter(ing => ing.material_name).map((ing, idx) => (
                      <div key={idx}>
                        <span className="text-gray-600">{ing.material_name}: </span>
                        <span className="font-medium text-blue-700">
                          {(ing.amount / formData.production_qty).toFixed(3)} {ing.unit}/개
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            <div className="flex gap-3 p-6 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
