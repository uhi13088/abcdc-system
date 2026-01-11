import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Semi-products (반제품) Management API
 * HACCP Module 9: Intermediate product management
 */

// GET - Fetch semi-products with filters
export async function GET(request: NextRequest) {
  const supabase = createClient();

  const { searchParams } = new URL(request.url);
  const productionDate = searchParams.get('production_date');
  const productCode = searchParams.get('product_code');
  const hasStock = searchParams.get('has_stock');
  const search = searchParams.get('search');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('semi_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (productionDate) {
      query = query.eq('production_date', productionDate);
    }

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    if (hasStock === 'true') {
      query = query.gt('remaining_qty', 0);
    }

    if (search) {
      query = query.or(`product_name.ilike.%${search}%,lot_number.ilike.%${search}%,product_code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching semi-products:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match frontend format
    const transformedData = (data || []).map(record => ({
      id: record.id,
      lotNumber: record.lot_number,
      productCode: record.product_code,
      productName: record.product_name,
      productionDate: record.production_date,
      inputMaterials: record.input_materials || [],
      production: {
        process: record.process_name,
        plannedQty: parseFloat(record.planned_qty) || 0,
        actualQty: parseFloat(record.actual_qty) || 0,
        unit: record.production_unit,
        yield: parseFloat(record.yield_percentage) || 0,
        startTime: record.start_time,
        endTime: record.end_time,
        workers: record.workers || [],
      },
      quality: {
        appearance: record.appearance,
        texture: record.texture,
        color: record.color_check,
        sampleTest: record.sample_test,
        testResult: record.test_result,
        inspectedBy: record.inspected_by,
      },
      storage: {
        location: record.storage_location,
        temperature: record.storage_temperature ? parseFloat(record.storage_temperature) : null,
        storageCondition: record.storage_condition,
        storedAt: record.stored_at,
      },
      usage: {
        used: parseFloat(record.used_qty) || 0,
        remaining: parseFloat(record.remaining_qty) || 0,
        usedFor: record.used_for || [],
      },
      createdAt: record.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: transformedData.length,
    });
  } catch (error) {
    console.error('Error fetching semi-products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new semi-product record
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info
    const { data: userData } = await supabase
      .from('users')
      .select('id, company_id, store_id, role')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'company_admin', 'manager', 'store_manager'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      product_code,
      product_name,
      production_date,
      input_materials,
      production,
      quality,
      storage
    } = body;

    // Validate required fields
    if (!product_code || !product_name || !production_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate LOT number
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const lotNumber = `SP-${today}-${randomSuffix}`;

    // Calculate yield
    const yieldPercentage = production?.planned_qty > 0
      ? Math.round((production.actual_qty / production.planned_qty) * 100)
      : 0;

    const { data, error } = await supabase
      .from('semi_products')
      .insert({
        company_id: userData.company_id,
        store_id: userData.store_id,
        lot_number: lotNumber,
        product_code,
        product_name,
        production_date,
        input_materials: input_materials || [],
        process_name: production?.process,
        planned_qty: production?.planned_qty || 0,
        actual_qty: production?.actual_qty || 0,
        production_unit: production?.unit || 'kg',
        yield_percentage: yieldPercentage,
        start_time: production?.start_time,
        end_time: production?.end_time,
        workers: production?.workers || [],
        appearance: quality?.appearance || 'NORMAL',
        texture: quality?.texture || 'NORMAL',
        color_check: quality?.color || 'NORMAL',
        sample_test: quality?.sample_test || false,
        test_result: quality?.test_result,
        inspected_by: quality?.inspected_by,
        storage_location: storage?.location,
        storage_temperature: storage?.temperature,
        storage_condition: storage?.storage_condition,
        stored_at: new Date().toISOString(),
        used_qty: 0,
        remaining_qty: production?.actual_qty || 0,
        used_for: [],
        created_by: userData.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating semi-product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: '반제품이 등록되었습니다.',
    });
  } catch (error) {
    console.error('Error creating semi-product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update semi-product usage
export async function PUT(request: NextRequest) {
  const supabase = createClient();
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

    // Get current semi-product
    const { data: current, error: fetchError } = await supabase
      .from('semi_products')
      .select('remaining_qty, used_qty, used_for')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Semi-product not found' }, { status: 404 });
    }

    // Validate remaining >= used_amount
    const remainingQty = parseFloat(current.remaining_qty) || 0;
    if (used_amount > remainingQty) {
      return NextResponse.json(
        { error: '사용량이 잔량을 초과합니다.' },
        { status: 400 }
      );
    }

    // Update usage
    const newUsed = (parseFloat(current.used_qty) || 0) + used_amount;
    const newRemaining = remainingQty - used_amount;
    const newUsedFor = [...(current.used_for || [])];
    if (used_for && !newUsedFor.includes(used_for)) {
      newUsedFor.push(used_for);
    }

    const { data, error } = await supabase
      .from('semi_products')
      .update({
        used_qty: newUsed,
        remaining_qty: newRemaining,
        used_for: newUsedFor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating semi-product usage:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '반제품 사용량이 업데이트되었습니다.',
      data,
    });
  } catch (error) {
    console.error('Error updating semi-product usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
