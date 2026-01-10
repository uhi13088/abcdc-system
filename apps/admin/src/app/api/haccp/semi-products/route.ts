import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Semi-products (반제품) Management API
 * HACCP Module 9: Intermediate product management
 */

interface SemiProductInput {
  product_code: string;
  product_name: string;
  production_date: string;
  input_materials: Array<{
    material_code: string;
    material_name: string;
    material_lot: string;
    quantity: number;
    unit: string;
  }>;
  production: {
    process: string;
    planned_qty: number;
    actual_qty: number;
    unit: string;
    start_time: string;
    end_time: string;
    workers: string[];
  };
  quality: {
    appearance: 'NORMAL' | 'ABNORMAL';
    texture: 'NORMAL' | 'ABNORMAL';
    color: 'NORMAL' | 'ABNORMAL';
    sample_test: boolean;
    test_result?: 'PASS' | 'FAIL' | null;
    inspected_by?: string;
  };
  storage: {
    location: string;
    temperature?: number;
    storage_condition: string;
  };
}

// GET - Fetch semi-products with filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const productionDate = searchParams.get('production_date');
  const productCode = searchParams.get('product_code');
  const hasStock = searchParams.get('has_stock');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implement actual database query
    // For now, return mock data structure
    const mockSemiProducts = [
      {
        id: '1',
        lot_number: 'SP-20260110-001',
        product_code: 'SP001',
        product_name: '양념장 베이스',
        production_date: '2026-01-10',
        input_materials: [
          { material_code: 'M001', material_name: '고춧가루', material_lot: 'ML-001', quantity: 10, unit: 'kg' },
          { material_code: 'M002', material_name: '마늘', material_lot: 'ML-002', quantity: 5, unit: 'kg' },
        ],
        production: {
          process: '혼합/숙성',
          planned_qty: 50,
          actual_qty: 48,
          unit: 'kg',
          yield: 96,
          start_time: '09:00',
          end_time: '11:30',
          workers: ['김생산', '이품질'],
        },
        quality: {
          appearance: 'NORMAL',
          texture: 'NORMAL',
          color: 'NORMAL',
          sample_test: true,
          test_result: 'PASS',
          inspected_by: '박검사',
        },
        storage: {
          location: '냉장고 A-2',
          temperature: 4,
          storage_condition: '냉장 보관 (0-10°C)',
          stored_at: '2026-01-10T11:45:00Z',
        },
        usage: {
          used: 20,
          remaining: 28,
          used_for: ['김치찌개용', '비빔밥용'],
        },
        created_at: '2026-01-10T09:00:00Z',
      },
    ];

    // Apply filters
    let filteredProducts = mockSemiProducts;

    if (productionDate) {
      filteredProducts = filteredProducts.filter(p => p.production_date === productionDate);
    }

    if (productCode) {
      filteredProducts = filteredProducts.filter(p => p.product_code === productCode);
    }

    if (hasStock === 'true') {
      filteredProducts = filteredProducts.filter(p => p.usage.remaining > 0);
    }

    return NextResponse.json({
      success: true,
      data: filteredProducts,
      total: filteredProducts.length,
    });
  } catch (error) {
    console.error('Error fetching semi-products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new semi-product record
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body: SemiProductInput = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.product_code || !body.product_name || !body.production_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate LOT number
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const lotNumber = `SP-${today}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // Calculate yield
    const yieldPercentage = body.production.planned_qty > 0
      ? Math.round((body.production.actual_qty / body.production.planned_qty) * 100)
      : 0;

    // TODO: Implement actual database insert
    // const { data, error } = await supabase
    //   .from('semi_product_records')
    //   .insert({
    //     company_id: user.company_id,
    //     lot_number: lotNumber,
    //     product_code: body.product_code,
    //     product_name: body.product_name,
    //     production_date: body.production_date,
    //     input_materials: body.input_materials,
    //     production: { ...body.production, yield: yieldPercentage },
    //     quality: body.quality,
    //     storage: body.storage,
    //     usage: { used: 0, remaining: body.production.actual_qty, used_for: [] },
    //     created_by: user.id,
    //   })
    //   .select()
    //   .single();

    const mockResponse = {
      id: crypto.randomUUID(),
      lot_number: lotNumber,
      product_code: body.product_code,
      product_name: body.product_name,
      production_date: body.production_date,
      input_materials: body.input_materials,
      production: { ...body.production, yield: yieldPercentage },
      quality: body.quality,
      storage: {
        ...body.storage,
        stored_at: new Date().toISOString(),
      },
      usage: {
        used: 0,
        remaining: body.production.actual_qty,
        used_for: [],
      },
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: mockResponse,
      message: '반제품이 등록되었습니다.',
    });
  } catch (error) {
    console.error('Error creating semi-product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update semi-product usage
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, used_amount, used_for } = body;

    if (!id || used_amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields (id, used_amount)' },
        { status: 400 }
      );
    }

    // TODO: Implement actual database update
    // 1. Get current semi-product
    // 2. Validate remaining >= used_amount
    // 3. Update usage (add to used, subtract from remaining, append to used_for)

    return NextResponse.json({
      success: true,
      message: '반제품 사용량이 업데이트되었습니다.',
      data: {
        id,
        used_amount,
        used_for,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating semi-product usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
