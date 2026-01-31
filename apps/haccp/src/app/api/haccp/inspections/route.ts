import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';
import { generateMaterialLotNumber } from '@/lib/utils/lot-number';

export const dynamic = 'force-dynamic';

// GET /api/haccp/inspections
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const materialType = searchParams.get('material_type');
    const result = searchParams.get('result');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    let query = adminClient
      .from('material_inspections')
      .select(`
        *,
        materials:material_id (id, name, code, type, storage_temp, shelf_life),
        suppliers:supplier_id (id, name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('inspection_date', date);

    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    if (result) {
      query = query.eq('overall_result', result);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultData = (data || []).map((i: any) => ({
      ...i,
      material_name: i.materials?.name,
      material_code: i.materials?.code,
      material_type: i.material_type || i.materials?.type,
      material_storage_temp: i.materials?.storage_temp,
      supplier_name: i.suppliers?.name,
    }));

    return NextResponse.json(resultData);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/inspections
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, name, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 현재 선택된 매장
    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    // 원부재료 정보 조회 (material_type, code 자동 설정)
    let materialType = body.material_type;
    let materialCode = body.material_code;
    if (body.material_id && (!materialType || !materialCode)) {
      const { data: material } = await adminClient
        .from('materials')
        .select('type, code')
        .eq('id', body.material_id)
        .single();
      if (!materialType) materialType = material?.type;
      if (!materialCode) materialCode = material?.code;
    }

    // 검사 기준 조회하여 결과 자동 계산
    let overallResult = body.overall_result;
    if (!overallResult && materialType) {
      const { data: standard } = await adminClient
        .from('material_inspection_standards')
        .select('required_checks, pass_threshold, conditional_threshold')
        .eq('company_id', userProfile.company_id)
        .eq('material_type', materialType)
        .single();

      if (standard) {
        const requiredChecks = standard.required_checks as Record<string, boolean>;
        let passCount = 0;
        let totalRequired = 0;

        // 필수 항목 체크
        const checkFields = [
          'appearance_check', 'packaging_check', 'label_check', 'expiry_check',
          'document_check', 'foreign_matter_check', 'odor_check', 'weight_check',
          'sensory_check', 'freshness_check', 'color_check', 'texture_check',
          'packaging_integrity_check', 'printing_check', 'specification_check',
          'test_report_check', 'certificate_check'
        ];

        for (const field of checkFields) {
          if (requiredChecks[field]) {
            totalRequired++;
            if (body[field] === true) {
              passCount++;
            }
          }
        }

        // temp_check 처리 (객체 형태)
        if (requiredChecks.temp_check) {
          totalRequired++;
          if (body.temp_check?.passed) {
            passCount++;
          }
        }

        const passThreshold = standard.pass_threshold || 9;
        const conditionalThreshold = standard.conditional_threshold || 7;

        if (passCount >= passThreshold || passCount === totalRequired) {
          overallResult = 'PASS';
        } else if (passCount >= conditionalThreshold) {
          overallResult = 'CONDITIONAL';
        } else {
          overallResult = 'FAIL';
        }
      }
    }

    // 로트번호 자동생성 (body에 없으면)
    const autoLotNumber = body.lot_number || await generateMaterialLotNumber(adminClient, userProfile.company_id, materialCode);

    const insertData = {
      company_id: userProfile.company_id,
      store_id: currentStoreId || null,
      inspected_by: userProfile.id,
      inspected_by_name: userProfile.name,
      material_type: materialType,
      overall_result: overallResult || body.overall_result,
      ...body,
      lot_number: autoLotNumber,
      supplier_id: body.supplier_id || null,
    };

    const { data, error } = await adminClient
      .from('material_inspections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ========================================
    // 검사 합격 시 자동 재고 반영
    // ========================================
    let stockCreated = null;
    const finalResult = overallResult || body.overall_result;

    if (finalResult === 'PASS' && body.material_id && body.quantity && body.quantity > 0) {
      try {
        // 원료 단위 정보 조회
        const { data: material } = await adminClient
          .from('materials')
          .select('unit')
          .eq('id', body.material_id)
          .single();

        const unit = body.unit || material?.unit || 'kg';
        // 검사에서 생성된 로트번호 사용
        const lotNumber = autoLotNumber;
        const today = new Date().toISOString().split('T')[0];

        // 동일 LOT 번호 재고가 이미 있는지 확인
        let existingStockQuery = adminClient
          .from('material_stocks')
          .select('id, quantity')
          .eq('company_id', userProfile.company_id)
          .eq('material_id', body.material_id)
          .eq('lot_number', lotNumber);

        if (currentStoreId) {
          existingStockQuery = existingStockQuery.eq('store_id', currentStoreId);
        }

        const { data: existingStock } = await existingStockQuery.maybeSingle();

        if (existingStock) {
          // 기존 재고에 수량 추가
          await adminClient
            .from('material_stocks')
            .update({
              quantity: existingStock.quantity + body.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);

          stockCreated = { id: existingStock.id, action: 'updated' };
        } else {
          // 새 재고 생성
          const { data: newStock } = await adminClient
            .from('material_stocks')
            .insert({
              company_id: userProfile.company_id,
              store_id: currentStoreId || null,
              material_id: body.material_id,
              lot_number: lotNumber,
              quantity: body.quantity,
              unit: unit,
              received_date: today,
              expiry_date: body.expiry_date || null,
              location: body.storage_location || null,
              status: 'AVAILABLE',
            })
            .select()
            .single();

          stockCreated = { id: newStock?.id, action: 'created' };
        }

        // 입고 트랜잭션 기록
        await adminClient
          .from('material_transactions')
          .insert({
            company_id: userProfile.company_id,
            store_id: currentStoreId || null,
            material_id: body.material_id,
            transaction_type: 'IN',
            transaction_date: today,
            quantity: body.quantity,
            unit: unit,
            lot_number: lotNumber,
            recorded_by: userProfile.id,
            notes: `입고검사 합격 자동 입고 (검사ID: ${data.id})`,
          });

        // eslint-disable-next-line no-console
        console.log(`[Inspection] Auto-created stock for material ${body.material_id}, qty: ${body.quantity}`);
      } catch (stockError) {
        // 재고 생성 실패해도 검사 기록은 저장됨
        console.error('Error auto-creating stock:', stockError);
      }
    }

    return NextResponse.json({ ...data, stock_created: stockCreated }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/inspections (검증/확인)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, name, company_id, store_id, current_store_id, current_haccp_store_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentStoreId = userProfile.current_haccp_store_id || userProfile.current_store_id || userProfile.store_id;

    // 검증 처리
    if (updateData.verify) {
      updateData.verified_by = userProfile.id;
      updateData.verified_by_name = userProfile.name;
      updateData.verified_at = new Date().toISOString();
      delete updateData.verify;
    }

    let query = adminClient
      .from('material_inspections')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id);

    if (currentStoreId) {
      query = query.eq('store_id', currentStoreId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error('Error updating inspection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
