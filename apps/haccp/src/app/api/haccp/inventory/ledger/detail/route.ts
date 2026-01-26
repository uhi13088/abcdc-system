import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 원료별 수불 상세 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const materialId = request.nextUrl.searchParams.get('material_id');
    const startDate = request.nextUrl.searchParams.get('start_date');
    const endDate = request.nextUrl.searchParams.get('end_date');

    if (!materialId) {
      return NextResponse.json({ error: 'material_id is required' }, { status: 400 });
    }

    // 원료 정보 조회
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, code, name, unit')
      .eq('id', materialId)
      .single();

    if (materialError || !material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // 기간 이전 재고 (시작 재고) 계산
    let openingBalance = 0;
    if (startDate) {
      const { data: beforeTx } = await supabase
        .from('material_transactions')
        .select('transaction_type, quantity')
        .eq('company_id', userData.company_id)
        .eq('material_id', materialId)
        .lt('transaction_date', startDate);

      beforeTx?.forEach((tx: any) => {
        switch (tx.transaction_type) {
          case 'IN':
            openingBalance += tx.quantity;
            break;
          case 'OUT':
            openingBalance -= tx.quantity;
            break;
          case 'ADJUST':
          case 'DISPOSE':
            openingBalance += tx.quantity;
            break;
        }
      });
    }

    // 기간 내 트랜잭션 조회
    let txQuery = supabase
      .from('material_transactions')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('material_id', materialId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (startDate) {
      txQuery = txQuery.gte('transaction_date', startDate);
    }
    if (endDate) {
      txQuery = txQuery.lte('transaction_date', endDate);
    }

    const { data: transactions, error: txError } = await txQuery;

    if (txError) {
      console.error('Failed to fetch transactions:', txError);
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // 일별 데이터로 그룹화
    const dailyMap = new Map<string, {
      date: string;
      in_quantity: number;
      out_quantity: number;
      adjust_quantity: number;
      production_lots: string[];
      details: any[];
    }>();

    transactions?.forEach((tx: any) => {
      const date = tx.transaction_date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          in_quantity: 0,
          out_quantity: 0,
          adjust_quantity: 0,
          production_lots: [],
          details: [],
        });
      }

      const daily = dailyMap.get(date)!;
      daily.details.push({
        id: tx.id,
        type: tx.transaction_type,
        quantity: tx.quantity,
        lot_number: tx.lot_number,
        production_lot: tx.production_lot,
        notes: tx.notes,
      });

      switch (tx.transaction_type) {
        case 'IN':
          daily.in_quantity += tx.quantity;
          break;
        case 'OUT':
          daily.out_quantity += tx.quantity;
          if (tx.production_lot && !daily.production_lots.includes(tx.production_lot)) {
            daily.production_lots.push(tx.production_lot);
          }
          break;
        case 'ADJUST':
        case 'DISPOSE':
          daily.adjust_quantity += tx.quantity;
          break;
      }
    });

    // 일별 데이터를 배열로 변환하고 누적 재고 계산
    const dailyTransactions = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    let runningBalance = openingBalance;
    const transactionsWithBalance = dailyTransactions.map(daily => {
      const opening = runningBalance;
      const closing = opening + daily.in_quantity - daily.out_quantity + daily.adjust_quantity;
      runningBalance = closing;

      return {
        ...daily,
        opening_balance: opening,
        closing_balance: closing,
      };
    });

    // 현재 재고 조회 (실제 재고)
    const { data: currentStocks } = await supabase
      .from('material_stocks')
      .select('lot_number, quantity, unit, status, expiry_date, location')
      .eq('company_id', userData.company_id)
      .eq('material_id', materialId)
      .neq('status', 'DISPOSED')
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true });

    return NextResponse.json({
      material_id: material.id,
      material_code: material.code,
      material_name: material.name,
      unit: material.unit,
      period_start: startDate,
      period_end: endDate,
      opening_balance: openingBalance,
      current_balance: runningBalance,
      transactions: transactionsWithBalance,
      current_stocks: currentStocks || [],
    });
  } catch (error) {
    console.error('Failed to fetch material detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
