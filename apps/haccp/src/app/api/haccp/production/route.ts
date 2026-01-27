import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateProductionLotNumber } from '@/lib/utils/lot-number';

export const dynamic = 'force-dynamic';

// GET /api/haccp/production
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const status = searchParams.get('status');
    const qualityStatus = searchParams.get('quality_status');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let query = supabase
      .from('production_records')
      .select(`
        *,
        products:product_id (id, name, code, category),
        supervisor:supervisor_id (id, name),
        quality_checker:quality_checked_by (name),
        approver:approved_by (name)
      `)
      .eq('company_id', userProfile.company_id)
      .eq('production_date', date);

    if (status) {
      query = query.eq('status', status);
    }

    if (qualityStatus) {
      query = query.eq('quality_check_status', qualityStatus);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching production records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data || []).map((r: any) => ({
      ...r,
      product_name: r.products?.name,
      product_code: r.products?.code,
      product_category: r.products?.category,
      supervisor_name: r.supervisor_name || r.supervisor?.name,
      quality_checked_by_name: r.quality_checked_by_name || r.quality_checker?.name,
      approved_by_name: r.approved_by_name || r.approver?.name,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/production
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 생산조건 저장 (JSONB로도 저장 - 호환성)
    const productionConditions = {
      temperature: body.temperature,
      humidity: body.humidity,
      ...(body.production_conditions || {}),
    };

    // 제품코드 조회 (로트번호 생성용)
    let productCode = body.product_code;
    if (body.product_id && !productCode) {
      const { data: product } = await supabase
        .from('products')
        .select('code')
        .eq('id', body.product_id)
        .single();
      productCode = product?.code;
    }

    // 로트번호 자동생성
    const autoLotNumber = body.lot_number || await generateProductionLotNumber(supabase, userProfile.company_id, productCode);

    const insertData = {
      company_id: userProfile.company_id,
      supervisor_id: userProfile.id,
      supervisor_name: userProfile.name,
      status: body.status || 'IN_PROGRESS',
      quality_check_status: 'PENDING',
      approval_status: 'PENDING',
      production_conditions: productionConditions,
      ...body,
      lot_number: autoLotNumber,
    };

    const { data, error } = await supabase
      .from('production_records')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating production record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/production
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 특수 액션 처리
    let correctiveActionCreated = null;

    if (action === 'quality_check') {
      // 품질검사 수행
      const qualityCheckItems = {
        appearance_check: { label: '외관검사', value: updateData.appearance_check },
        weight_check: { label: '중량검사', value: updateData.weight_check },
        packaging_check: { label: '포장상태', value: updateData.packaging_check },
        label_check: { label: '라벨표시', value: updateData.label_check },
        metal_detection_check: { label: '금속검출', value: updateData.metal_detection_check },
        taste_check: { label: '맛검사', value: updateData.taste_check },
        smell_check: { label: '냄새검사', value: updateData.smell_check },
        color_check: { label: '색상검사', value: updateData.color_check },
      };

      const qualityChecks = Object.values(qualityCheckItems)
        .filter(item => item.value !== undefined)
        .map(item => item.value);

      const passCount = qualityChecks.filter(Boolean).length;
      const totalChecks = qualityChecks.length;

      let qualityStatus = 'PASS';
      if (totalChecks > 0) {
        if (passCount === totalChecks) {
          qualityStatus = 'PASS';
        } else if (passCount >= totalChecks * 0.7) {
          qualityStatus = 'CONDITIONAL';
        } else {
          qualityStatus = 'FAIL';
        }
      }

      updateData.quality_check_status = qualityStatus;
      updateData.quality_checked_by = userProfile.id;
      updateData.quality_checked_by_name = userProfile.name;
      updateData.quality_checked_at = new Date().toISOString();

      // ========================================
      // 품질 FAIL 시 자동 개선조치 생성
      // ========================================
      if (qualityStatus === 'FAIL') {
        try {
          // 생산 기록 조회
          const { data: productionRecord } = await supabase
            .from('production_records')
            .select('lot_number, product_id, products:product_id(name, code)')
            .eq('id', id)
            .single();

          // 실패한 항목 목록
          const failedItems = Object.entries(qualityCheckItems)
            .filter(([, item]) => item.value === false)
            .map(([, item]) => item.label)
            .join(', ');

          const productInfo = productionRecord?.products as { name?: string; code?: string } | null;
          const productName = productInfo?.name || '제품';
          const lotNumber = productionRecord?.lot_number || id;

          const problemDesc = `[생산품질검사 부적합]\n` +
            `제품: ${productName}\n` +
            `LOT: ${lotNumber}\n` +
            `부적합 항목: ${failedItems}\n` +
            `검사자: ${userProfile.name}`;

          const today = new Date();
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 3); // 3일 내 조치

          const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const actionNumber = `CA-${dateStr}-${random}`;

          const { data: caData } = await supabase
            .from('corrective_actions')
            .insert({
              company_id: userProfile.company_id,
              action_number: actionNumber,
              action_date: today.toISOString().split('T')[0],
              source_type: 'PRODUCTION',
              source_id: id,
              problem_description: problemDesc,
              severity: 'MAJOR',
              due_date: dueDate.toISOString().split('T')[0],
              status: 'OPEN',
              assigned_to: userProfile.id,
            })
            .select()
            .single();

          if (caData) {
            correctiveActionCreated = caData;
            updateData.corrective_action_id = caData.id;

            // 관리자에게 알림
            const { data: managers } = await supabase
              .from('users')
              .select('id')
              .eq('company_id', userProfile.company_id)
              .in('role', ['HACCP_MANAGER', 'COMPANY_ADMIN']);

            for (const manager of managers || []) {
              await supabase.from('notifications').insert({
                user_id: manager.id,
                category: 'PRODUCTION',
                priority: 'HIGH',
                title: `⚠️ 생산품질검사 부적합 - ${productName}`,
                message: `LOT ${lotNumber} 품질검사 부적합 (${failedItems}). 개선조치가 자동 생성되었습니다.`,
                action_url: '/corrective-actions',
                is_read: false,
              });
            }

            // eslint-disable-next-line no-console
            console.log(`[Production] Auto-created corrective action for quality failure: ${id}`);
          }
        } catch (caError) {
          console.error('Error creating corrective action for quality failure:', caError);
        }
      }

      // ========================================
      // 품질 PASS 시 자동 승인
      // ========================================
      if (qualityStatus === 'PASS') {
        updateData.approval_status = 'APPROVED';
        updateData.approved_by = userProfile.id;
        updateData.approved_by_name = userProfile.name;
        updateData.approved_at = new Date().toISOString();
        // eslint-disable-next-line no-console
        console.log(`[Production] Auto-approved production ${id} after quality PASS`);
      }
    }

    if (action === 'approve') {
      updateData.approval_status = 'APPROVED';
      updateData.approved_by = userProfile.id;
      updateData.approved_by_name = userProfile.name;
      updateData.approved_at = new Date().toISOString();
    }

    if (action === 'reject') {
      updateData.approval_status = 'REJECTED';
      updateData.approved_by = userProfile.id;
      updateData.approved_by_name = userProfile.name;
      updateData.approved_at = new Date().toISOString();
    }

    if (action === 'hold') {
      updateData.approval_status = 'HOLD';
    }

    if (action === 'complete') {
      updateData.status = 'COMPLETED';
      updateData.end_time = updateData.end_time || new Date().toTimeString().split(' ')[0];
    }

    // ========================================
    // 생산 완료 시 원료 자동 차감
    // ========================================
    let materialUsageResult = null;

    if (action === 'complete') {
      try {
        // 생산 기록 조회 (product_id, actual_quantity 등)
        const { data: productionRecord } = await supabase
          .from('production_records')
          .select('product_id, semi_product_id, actual_quantity, lot_number, production_date, material_usage_processed')
          .eq('id', id)
          .single();

        // 이미 원료 처리된 경우 스킵
        if (productionRecord && !productionRecord.material_usage_processed) {
          const productId = productionRecord.product_id;
          const semiProductId = productionRecord.semi_product_id;
          const quantityProduced = productionRecord.actual_quantity || updateData.actual_quantity;
          const lotNumber = productionRecord.lot_number || id;
          const productionDate = productionRecord.production_date;

          if ((productId || semiProductId) && quantityProduced && quantityProduced > 0) {
            // 레시피 조회
            let recipeQuery = supabase
              .from('product_recipes')
              .select('*')
              .eq('company_id', userProfile.company_id);

            if (productId) {
              recipeQuery = recipeQuery.eq('product_id', productId);
            } else if (semiProductId) {
              recipeQuery = recipeQuery.eq('semi_product_id', semiProductId);
            }

            const { data: recipes } = await recipeQuery;

            if (recipes && recipes.length > 0) {
              const usageResults: Array<{
                material_name: string;
                required: number;
                actual: number;
                shortage: number;
              }> = [];

              for (const recipe of recipes as Array<{
                id: string;
                material_code: string | null;
                material_name: string;
                amount: number;
                unit: string;
                amount_per_unit: number | null;
                production_qty?: number;
              }>) {
                // 필요량 계산
                let requiredAmount: number;
                if (recipe.amount_per_unit && recipe.amount_per_unit > 0) {
                  requiredAmount = recipe.amount_per_unit * quantityProduced;
                } else if (recipes[0] && (recipes[0] as { production_qty?: number }).production_qty) {
                  const batchQty = (recipes[0] as { production_qty: number }).production_qty;
                  requiredAmount = (recipe.amount / batchQty) * quantityProduced;
                } else {
                  requiredAmount = recipe.amount;
                }

                // 원료 ID 찾기
                let materialId: string | null = null;
                if (recipe.material_code) {
                  const { data: material } = await supabase
                    .from('materials')
                    .select('id')
                    .eq('company_id', userProfile.company_id)
                    .eq('code', recipe.material_code)
                    .single();
                  materialId = material?.id || null;
                }

                if (!materialId) {
                  const { data: material } = await supabase
                    .from('materials')
                    .select('id')
                    .eq('company_id', userProfile.company_id)
                    .ilike('name', recipe.material_name)
                    .single();
                  materialId = material?.id || null;
                }

                if (!materialId) {
                  usageResults.push({
                    material_name: recipe.material_name,
                    required: requiredAmount,
                    actual: 0,
                    shortage: requiredAmount,
                  });
                  continue;
                }

                // FIFO 재고 출고
                const { data: stocks } = await supabase
                  .from('material_stocks')
                  .select('*')
                  .eq('company_id', userProfile.company_id)
                  .eq('material_id', materialId)
                  .eq('status', 'AVAILABLE')
                  .gt('quantity', 0)
                  .order('expiry_date', { ascending: true, nullsFirst: false })
                  .order('received_date', { ascending: true });

                let remainingAmount = requiredAmount;
                let actualDeducted = 0;

                for (const stock of (stocks || []) as Array<{
                  id: string;
                  lot_number: string;
                  quantity: number;
                }>) {
                  if (remainingAmount <= 0) break;

                  const deductAmount = Math.min(stock.quantity, remainingAmount);

                  // 출고 트랜잭션
                  await supabase
                    .from('material_transactions')
                    .insert({
                      company_id: userProfile.company_id,
                      transaction_date: productionDate || new Date().toISOString().split('T')[0],
                      transaction_type: 'OUT',
                      material_id: materialId,
                      lot_number: stock.lot_number,
                      quantity: deductAmount,
                      unit: recipe.unit,
                      production_lot: lotNumber,
                      notes: `생산 완료 자동출고 - ${recipe.material_name}`,
                      recorded_by: userProfile.id,
                    });

                  // 재고 업데이트
                  const newQty = stock.quantity - deductAmount;
                  await supabase
                    .from('material_stocks')
                    .update({
                      quantity: newQty,
                      status: newQty <= 0 ? 'DISPOSED' : 'AVAILABLE',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', stock.id);

                  actualDeducted += deductAmount;
                  remainingAmount -= deductAmount;
                }

                usageResults.push({
                  material_name: recipe.material_name,
                  required: requiredAmount,
                  actual: actualDeducted,
                  shortage: remainingAmount > 0 ? remainingAmount : 0,
                });
              }

              // 생산 기록에 원료 사용 정보 저장
              updateData.material_usage_processed = true;
              updateData.material_usage_summary = usageResults;

              materialUsageResult = {
                processed: true,
                materials: usageResults,
                has_shortage: usageResults.some(r => r.shortage > 0),
              };

              // eslint-disable-next-line no-console
              console.log(`[Production] Auto-deducted materials for production ${id}`);
            }
          }
        }
      } catch (materialError) {
        // 원료 차감 실패해도 생산 완료는 진행
        console.error('Error auto-deducting materials:', materialError);
        materialUsageResult = { processed: false, error: 'Material deduction failed' };
      }
    }

    // 생산조건 업데이트
    if (updateData.temperature !== undefined || updateData.humidity !== undefined) {
      const { data: existing } = await supabase
        .from('production_records')
        .select('production_conditions')
        .eq('id', id)
        .single();

      updateData.production_conditions = {
        ...(existing?.production_conditions || {}),
        temperature: updateData.temperature,
        humidity: updateData.humidity,
      };
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('production_records')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userProfile.company_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating production record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 원료 사용 결과 및 개선조치 포함하여 반환
    return NextResponse.json({
      ...data,
      material_usage: materialUsageResult,
      corrective_action: correctiveActionCreated,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
