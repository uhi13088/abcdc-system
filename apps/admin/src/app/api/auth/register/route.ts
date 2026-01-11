import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, companyName } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm email
    });

    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '사용자 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 2. Create or get company (if company name provided)
    let companyId = null;
    if (companyName) {
      // Check if company exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .single();

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Create new company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: companyName,
            status: 'ACTIVE',
          })
          .select('id')
          .single();

        if (companyError) {
          console.error('Company creation error:', companyError);
        } else {
          companyId = newCompany.id;
        }
      }
    }

    // 3. Create user profile in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email: email,
        name: name,
        role: 'admin', // Default role for admin registration
        status: 'ACTIVE',
        company_id: companyId,
      })
      .select()
      .single();

    if (userError) {
      console.error('User profile error:', userError);
      // Rollback: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: '사용자 프로필 생성에 실패했습니다: ' + userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
