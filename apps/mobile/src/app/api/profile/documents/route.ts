import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - 요청된 서류 및 제출된 서류 조회
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, required_documents, documents, bank_name, bank_account, account_holder')
      .eq('auth_id', user.id)
      .single();

    if (userError) {
      console.error('User fetch error:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 기존 bank 정보가 있으면 documents에 통합
    const uploadedDocuments = userData.documents || {};
    if (userData.bank_name && userData.bank_account) {
      if (!uploadedDocuments.bank_copy) {
        uploadedDocuments.bank_copy = {
          type: 'bank_copy',
          url: '',
          uploaded_at: '',
          bank_name: userData.bank_name,
          account_number: userData.bank_account,
          account_holder: userData.account_holder,
        };
      }
    }

    return NextResponse.json({
      required_documents: userData.required_documents || [],
      uploaded_documents: uploadedDocuments,
    });
  } catch (error) {
    console.error('GET documents error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - 서류 메타데이터 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, url, uploaded_at, expiry_date, bank_name, account_number, account_holder } = body;

    if (!type) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 });
    }

    // 현재 사용자의 documents 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, documents')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // documents 업데이트
    const documents = userData.documents || {};
    documents[type] = {
      type,
      url,
      uploaded_at,
      ...(expiry_date && { expiry_date }),
      ...(bank_name && { bank_name }),
      ...(account_number && { account_number }),
      ...(account_holder && { account_holder }),
    };

    // 은행 정보인 경우 users 테이블의 bank 필드도 업데이트
    const updateData: Record<string, unknown> = { documents };
    if (type === 'bank_copy' && bank_name && account_number && account_holder) {
      updateData.bank_name = bank_name;
      updateData.bank_account = account_number;
      updateData.account_holder = account_holder;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userData.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST documents error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
