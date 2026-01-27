import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 원료수불부 데이터 조회
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

    const startDate = request.nextUrl.searchParams.get('start_date');
    const endDate = request.nextUrl.searchParams.get('end_date');
    const viewMode = request.nextUrl.searchParams.get('view_mode') || 'summary';
    const materialId = request.nextUrl.searchParams.get('material_id');

    // 현재 재고 요약 조회
    const summaryQuery = supabase
      .from('material_stocks')
      .select(`
        material_id,
        quantity,
        unit,
        status,
        expiry_date,
        lot_number,
        materials!inner(
          id,
          code,
          name,
          material_type
        )
      `)
      .eq('company_id', userData.company_id)
      .neq('status', 'DISPOSED');

    if (materialId) {
      summaryQuery.eq('material_id', materialId);
    }

    const { data: stocksData, error: stocksError } = await summaryQuery;

    if (stocksError) {
      console.error('Failed to fetch stocks:', stocksError);
      return NextResponse.json({ error: stocksError.message }, { status: 500 });
    }

    // 기간 내 트랜잭션 조회
    let transactionsQuery = supabase
      .from('material_transactions')
      .select(`
        id,
        material_id,
        transaction_type,
        transaction_date,
        quantity,
        unit,
        production_lot,
        materials!inner(
          id,
          code,
          name,
          material_type
        )
      `)
      .eq('company_id', userData.company_id)
      .order('transaction_date', { ascending: true });

    if (startDate) {
      transactionsQuery = transactionsQuery.gte('transaction_date', startDate);
    }
    if (endDate) {
      transactionsQuery = transactionsQuery.lte('transaction_date', endDate);
    }
    if (materialId) {
      transactionsQuery = transactionsQuery.eq('material_id', materialId);
    }

    const { data: transactionsData, error: transactionsError } = await transactionsQuery;

    if (transactionsError) {
      console.error('Failed to fetch transactions:', transactionsError);
      return NextResponse.json({ error: transactionsError.message }, { status: 500 });
    }

    // 요약 데이터 집계
    const summaryMap = new Map<string, {
      material_id: string;
      material_code: string;
      material_name: string;
      material_type: string | null;
      unit: string;
      total_in: number;
      total_out: number;
      total_adjust: number;
      current_stock: number;
      earliest_expiry: string | null;
      lot_count: number;
    }>();

    // 현재 재고 계산
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stocksData?.forEach((stock: any) => {
      const key = stock.material_id;
      const existing = summaryMap.get(key);
      const stockQty = stock.status === 'AVAILABLE' ? stock.quantity : 0;

      if (existing) {
        existing.current_stock += stockQty;
        if (stock.status === 'AVAILABLE' && stock.quantity > 0) {
          existing.lot_count += 1;
          if (stock.expiry_date && (!existing.earliest_expiry || stock.expiry_date < existing.earliest_expiry)) {
            existing.earliest_expiry = stock.expiry_date;
          }
        }
      } else {
        summaryMap.set(key, {
          material_id: stock.material_id,
          material_code: stock.materials.code,
          material_name: stock.materials.name,
          material_type: stock.materials.material_type,
          unit: stock.unit,
          total_in: 0,
          total_out: 0,
          total_adjust: 0,
          current_stock: stockQty,
          earliest_expiry: stock.status === 'AVAILABLE' && stock.quantity > 0 ? stock.expiry_date : null,
          lot_count: stock.status === 'AVAILABLE' && stock.quantity > 0 ? 1 : 0,
        });
      }
    });

    // 트랜잭션 합계
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactionsData?.forEach((tx: any) => {
      const key = tx.material_id;
      let existing = summaryMap.get(key);

      if (!existing) {
        existing = {
          material_id: tx.material_id,
          material_code: tx.materials.code,
          material_name: tx.materials.name,
          material_type: tx.materials.material_type,
          unit: tx.unit,
          total_in: 0,
          total_out: 0,
          total_adjust: 0,
          current_stock: 0,
          earliest_expiry: null,
          lot_count: 0,
        };
        summaryMap.set(key, existing);
      }

      switch (tx.transaction_type) {
        case 'IN':
          existing.total_in += tx.quantity;
          break;
        case 'OUT':
          existing.total_out += tx.quantity;
          break;
        case 'ADJUST':
        case 'DISPOSE':
          existing.total_adjust += tx.quantity;
          break;
      }
    });

    const summary = Array.from(summaryMap.values()).sort((a, b) =>
      a.material_code.localeCompare(b.material_code)
    );

    // 일별/월별 수불부 생성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledger: any[] = [];

    if (viewMode === 'daily' || viewMode === 'monthly') {
      // 날짜별로 그룹화
      const ledgerMap = new Map<string, Map<string, {
        material_id: string;
        material_code: string;
        material_name: string;
        unit: string;
        date: string;
        in_quantity: number;
        out_quantity: number;
        adjust_quantity: number;
        production_count: number;
      }>>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactionsData?.forEach((tx: any) => {
        let dateKey: string;
        if (viewMode === 'monthly') {
          dateKey = tx.transaction_date.substring(0, 7); // YYYY-MM
        } else {
          dateKey = tx.transaction_date;
        }

        if (!ledgerMap.has(tx.material_id)) {
          ledgerMap.set(tx.material_id, new Map());
        }
        const materialMap = ledgerMap.get(tx.material_id)!;

        if (!materialMap.has(dateKey)) {
          materialMap.set(dateKey, {
            material_id: tx.material_id,
            material_code: tx.materials.code,
            material_name: tx.materials.name,
            unit: tx.unit,
            date: dateKey,
            in_quantity: 0,
            out_quantity: 0,
            adjust_quantity: 0,
            production_count: 0,
          });
        }

        const entry = materialMap.get(dateKey)!;
        switch (tx.transaction_type) {
          case 'IN':
            entry.in_quantity += tx.quantity;
            break;
          case 'OUT':
            entry.out_quantity += tx.quantity;
            if (tx.production_lot) {
              entry.production_count += 1;
            }
            break;
          case 'ADJUST':
          case 'DISPOSE':
            entry.adjust_quantity += tx.quantity;
            break;
        }
      });

      // 시작 재고 계산을 위해 기간 이전 트랜잭션 조회
      const getOpeningBalance = async (materialId: string, beforeDate: string): Promise<number> => {
        const { data: beforeTx } = await supabase
          .from('material_transactions')
          .select('transaction_type, quantity')
          .eq('company_id', userData.company_id)
          .eq('material_id', materialId)
          .lt('transaction_date', beforeDate);

        if (!beforeTx) return 0;

        let balance = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        beforeTx.forEach((tx: any) => {
          switch (tx.transaction_type) {
            case 'IN':
              balance += tx.quantity;
              break;
            case 'OUT':
              balance -= tx.quantity;
              break;
            case 'ADJUST':
            case 'DISPOSE':
              balance += tx.quantity;
              break;
          }
        });
        return balance;
      };

      // 수불부 데이터 생성 (전일재고, 재고 계산)
      for (const [materialId, dateMap] of ledgerMap) {
        const dates = Array.from(dateMap.keys()).sort();
        let runningBalance = startDate ? await getOpeningBalance(materialId, startDate) : 0;

        for (const date of dates) {
          const entry = dateMap.get(date)!;
          const opening = runningBalance;
          const closing = opening + entry.in_quantity - entry.out_quantity + entry.adjust_quantity;

          ledger.push({
            ...entry,
            opening_balance: opening,
            closing_balance: closing,
          });

          runningBalance = closing;
        }
      }

      // 정렬: 원료코드 → 날짜
      ledger.sort((a, b) => {
        const codeCompare = a.material_code.localeCompare(b.material_code);
        if (codeCompare !== 0) return codeCompare;
        return a.date.localeCompare(b.date);
      });
    }

    return NextResponse.json({
      summary,
      ledger,
    });
  } catch (error) {
    console.error('Failed to fetch ledger:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
