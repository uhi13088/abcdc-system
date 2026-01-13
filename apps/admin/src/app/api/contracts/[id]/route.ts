import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/contracts/[id] - 계약서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const contractId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        staff:users!contracts_staff_id_fkey(id, name, email, phone, position, address, birth_date, ssn_encrypted, bank_name, bank_account, account_holder),
        stores(id, name, address, phone),
        brands(id, name),
        companies(id, name, business_number, ceo_name, address)
      `)
      .eq('id', contractId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT /api/contracts/[id] - 계약서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const contractId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check existing contract
    const { data: existingContract } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', contractId)
      .single();

    if (!existingContract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existingContract.status === 'SIGNED') {
      return NextResponse.json(
        { error: '서명된 계약서는 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from('contracts')
      .update(body)
      .eq('id', contractId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - 계약서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const contractId = params.id;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check existing contract
    const { data: existingContract } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', contractId)
      .single();

    if (!existingContract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existingContract.status === 'SIGNED') {
      return NextResponse.json(
        { error: '서명된 계약서는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
