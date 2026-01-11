import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Secret key to protect this endpoint - set in environment variables
const INIT_SECRET = process.env.INIT_SECRET_KEY || 'abc-staff-init-2024';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secretKey } = body;

    // Verify the secret key
    if (secretKey !== INIT_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // Check if super_admin already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'uhi1308@naver.com')
      .single();

    if (existingUser) {
      // Check if auth user exists
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUserExists = authUsers?.users?.some(u => u.email === 'uhi1308@naver.com');

      if (authUserExists) {
        return NextResponse.json({
          success: true,
          message: 'Super admin already exists',
          user: existingUser,
        });
      }
    }

    // Create super_admin user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'uhi1308@naver.com',
      password: 'Ghrnfldks12!!@',
      email_confirm: true,
      user_metadata: {
        name: '슈퍼 관리자',
        role: 'super_admin',
      },
    });

    if (authError) {
      // If user already exists in auth, try to get their ID
      if (authError.message.includes('already been registered')) {
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingAuthUser = users?.users?.find(u => u.email === 'uhi1308@naver.com');

        if (existingAuthUser) {
          // Upsert the users table record
          await supabase
            .from('users')
            .upsert({
              id: existingAuthUser.id,
              email: 'uhi1308@naver.com',
              name: '슈퍼 관리자',
              role: 'super_admin',
              status: 'ACTIVE',
            }, { onConflict: 'email' });

          return NextResponse.json({
            success: true,
            message: 'Super admin linked successfully',
            user: {
              id: existingAuthUser.id,
              email: 'uhi1308@naver.com',
            },
          });
        }
      }

      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create user record in the users table
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: 'uhi1308@naver.com',
        name: '슈퍼 관리자',
        role: 'super_admin',
        status: 'ACTIVE',
      }, { onConflict: 'email' });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Super admin created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: '슈퍼 관리자',
        role: 'super_admin',
      },
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
