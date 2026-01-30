'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Search, Filter, TrendingUp, TrendingDown,
  AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight,
  BarChart3, Box, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  code: string;
  name: string;
  unit?: string;
  category?: string;
  shelf_life?: number;
  storage_condition?: string;
}

interface ProductionRecord {
  id: string;
  lot_number: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  production_date: string;
  actual_quantity: number;
  unit: string;
  status: string;
  quality_check_status?: string;
  approval_status?: string;
}

interface ShipmentItem {
  id: string;
  product_id: string;
  lot_number: string;
  quantity: number;
  shipment_date: string;
}

interface InventoryStock {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  category?: string;
  storage_condition?: string;
  total_produced: number;
  total_shipped: number;
  current_stock: number;
  lots: {
    lot_number: string;
    production_date: string;
    quantity: number;
    shipped: number;
    remaining: number;
    expiry_date?: string;
  }[];
}

export default function FinishedProductInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStorage, setFilterStorage] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, []);

  const fetchProductionRecords = useCallback(async () => {
    try {
      // Fetch all completed production records
      const response = await fetch('/api/haccp/production?status=COMPLETED');
      if (response.ok) {
        const data = await response.json();
        setProductionRecords(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch production records:', error);
    }
  }, []);

  const fetchShipments = useCallback(async () => {
    try {
      const response = await fetch('/api/haccp/shipments?status=delivered');
      if (response.ok) {
        const data = await response.json();
        // Extract shipment items with product info
        const items: ShipmentItem[] = [];
        (data || []).forEach((shipment: { id: string; shipment_date: string; items?: { product_id: string; lot_number: string; quantity: number }[] }) => {
          if (shipment.items) {
            shipment.items.forEach((item: { product_id: string; lot_number: string; quantity: number }) => {
              items.push({
                id: shipment.id,
                product_id: item.product_id,
                lot_number: item.lot_number,
                quantity: item.quantity,
                shipment_date: shipment.shipment_date,
              });
            });
          }
        });
        setShipments(items);
      }
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchProductionRecords(), fetchShipments()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProducts, fetchProductionRecords, fetchShipments]);

  // Calculate inventory stocks from production and shipment data
  const inventoryStocks = useMemo<InventoryStock[]>(() => {
    const stockMap = new Map<string, InventoryStock>();

    // Group production by product
    productionRecords.forEach(record => {
      if (record.status !== 'COMPLETED' || record.approval_status !== 'APPROVED') return;

      const product = products.find(p => p.id === record.product_id);
      if (!product) return;

      let stock = stockMap.get(record.product_id);
      if (!stock) {
        stock = {
          product_id: record.product_id,
          product_code: product.code || '',
          product_name: product.name,
          unit: record.unit || product.unit || 'ea',
          category: product.category,
          storage_condition: product.storage_condition,
          total_produced: 0,
          total_shipped: 0,
          current_stock: 0,
          lots: [],
        };
        stockMap.set(record.product_id, stock);
      }

      stock.total_produced += record.actual_quantity;

      // Calculate expiry date
      let expiryDate: string | undefined;
      if (product.shelf_life) {
        const prodDate = new Date(record.production_date);
        prodDate.setDate(prodDate.getDate() + product.shelf_life);
        expiryDate = prodDate.toISOString().split('T')[0];
      }

      stock.lots.push({
        lot_number: record.lot_number,
        production_date: record.production_date,
        quantity: record.actual_quantity,
        shipped: 0,
        remaining: record.actual_quantity,
        expiry_date: expiryDate,
      });
    });

    // Apply shipments
    shipments.forEach(item => {
      const stock = stockMap.get(item.product_id);
      if (!stock) return;

      stock.total_shipped += item.quantity;

      // Find matching lot and deduct
      const lot = stock.lots.find(l => l.lot_number === item.lot_number);
      if (lot) {
        lot.shipped += item.quantity;
        lot.remaining = lot.quantity - lot.shipped;
      }
    });

    // Calculate current stock
    stockMap.forEach(stock => {
      stock.current_stock = stock.total_produced - stock.total_shipped;
      // Sort lots by production date (FIFO)
      stock.lots.sort((a, b) => a.production_date.localeCompare(b.production_date));
    });

    return Array.from(stockMap.values());
  }, [products, productionRecords, shipments]);

  // Get unique categories and storage conditions
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  const storageConditions = useMemo(() => {
    const conds = new Set(products.map(p => p.storage_condition).filter(Boolean));
    return Array.from(conds);
  }, [products]);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    return inventoryStocks.filter(stock => {
      if (searchTerm && !stock.product_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !stock.product_code.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterCategory && stock.category !== filterCategory) return false;
      if (filterStorage && stock.storage_condition !== filterStorage) return false;
      if (showLowStockOnly && stock.current_stock > 10) return false;
      return true;
    });
  }, [inventoryStocks, searchTerm, filterCategory, filterStorage, showLowStockOnly]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalProducts = filteredStocks.length;
    const totalStock = filteredStocks.reduce((sum, s) => sum + s.current_stock, 0);
    const lowStockCount = filteredStocks.filter(s => s.current_stock <= 10 && s.current_stock > 0).length;
    const outOfStockCount = filteredStocks.filter(s => s.current_stock === 0).length;
    const expiringCount = filteredStocks.filter(s =>
      s.lots.some(l => {
        if (!l.expiry_date || l.remaining <= 0) return false;
        const daysUntil = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 7 && daysUntil > 0;
      })
    ).length;
    return { totalProducts, totalStock, lowStockCount, outOfStockCount, expiringCount };
  }, [filteredStocks]);

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const getStorageLabel = (condition?: string) => {
    const labels: Record<string, string> = {
      cold: '냉장',
      frozen: '냉동',
      room_temp: '상온',
      cool: '서늘한곳',
      냉장: '냉장',
      냉동: '냉동',
      상온: '상온',
      '서늘한 곳': '서늘한곳',
    };
    return labels[condition || ''] || condition || '-';
  };

  const getStorageColor = (condition?: string) => {
    const colors: Record<string, string> = {
      cold: 'bg-blue-100 text-blue-700',
      frozen: 'bg-indigo-100 text-indigo-700',
      room_temp: 'bg-amber-100 text-amber-700',
      cool: 'bg-teal-100 text-teal-700',
      냉장: 'bg-blue-100 text-blue-700',
      냉동: 'bg-indigo-100 text-indigo-700',
      상온: 'bg-amber-100 text-amber-700',
      '서늘한 곳': 'bg-teal-100 text-teal-700',
    };
    return colors[condition || ''] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-7 h-7 text-blue-600" />
          완제품 재고관리
        </h1>
        <p className="text-gray-500 mt-1">생산 완료된 제품의 재고 현황</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Box className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">등록 제품</p>
              <p className="text-lg font-bold">{summaryStats.totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">총 재고</p>
              <p className="text-lg font-bold">{summaryStats.totalStock.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">재고 부족</p>
              <p className="text-lg font-bold text-yellow-600">{summaryStats.lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">재고 없음</p>
              <p className="text-lg font-bold text-red-600">{summaryStats.outOfStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">유통기한 임박</p>
              <p className="text-lg font-bold text-orange-600">{summaryStats.expiringCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="제품명 또는 코드 검색..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg min-w-[150px]"
          >
            <option value="">전체 카테고리</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterStorage}
            onChange={(e) => setFilterStorage(e.target.value)}
            className="px-4 py-2 border rounded-lg min-w-[150px]"
          >
            <option value="">전체 보관조건</option>
            {storageConditions.map(cond => (
              <option key={cond} value={cond}>{getStorageLabel(cond)}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
            />
            <span className="text-sm">재고 부족만</span>
          </label>
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">제품</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">카테고리</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">보관</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">생산량</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">출하량</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">현재고</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">LOT</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStocks.map((stock) => {
              const isExpanded = expandedProducts.has(stock.product_id);
              const activeLots = stock.lots.filter(l => l.remaining > 0);

              return (
                <>
                  <tr key={stock.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{stock.product_name}</p>
                        <p className="text-xs text-gray-500">{stock.product_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{stock.category || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStorageColor(stock.storage_condition)}`}>
                        {getStorageLabel(stock.storage_condition)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <span className="text-green-600 flex items-center justify-end gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        {stock.total_produced.toLocaleString()} {stock.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <span className="text-blue-600 flex items-center justify-end gap-1">
                        <ArrowDownRight className="w-3 h-3" />
                        {stock.total_shipped.toLocaleString()} {stock.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${
                        stock.current_stock === 0 ? 'text-red-600' :
                        stock.current_stock <= 10 ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {stock.current_stock.toLocaleString()} {stock.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleExpand(stock.product_id)}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        {activeLots.length}개 LOT {isExpanded ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && activeLots.length > 0 && (
                    <tr key={`${stock.product_id}-lots`}>
                      <td colSpan={7} className="bg-gray-50 px-4 py-3">
                        <div className="ml-8 space-y-2">
                          <p className="text-xs font-medium text-gray-500 mb-2">LOT별 재고 (FIFO 순)</p>
                          <div className="grid gap-2">
                            {activeLots.map(lot => {
                              const daysUntilExpiry = lot.expiry_date
                                ? Math.ceil((new Date(lot.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                : null;
                              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7;

                              return (
                                <div key={lot.lot_number} className="flex items-center gap-4 text-sm bg-white p-2 rounded border">
                                  <span className="font-mono font-medium">{lot.lot_number}</span>
                                  <span className="text-gray-500">생산: {lot.production_date}</span>
                                  {lot.expiry_date && (
                                    <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                                      {isExpiringSoon && <AlertTriangle className="w-3 h-3" />}
                                      유통기한: {lot.expiry_date}
                                      {daysUntilExpiry !== null && ` (${daysUntilExpiry}일)`}
                                    </span>
                                  )}
                                  <span className="ml-auto font-medium">
                                    {lot.remaining.toLocaleString()} {stock.unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filteredStocks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>재고 데이터가 없습니다</p>
                  <p className="text-sm">생산 완료 및 승인된 기록이 여기에 표시됩니다</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
