import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/seed
 *
 * 초기 사용자 시드 API
 * - 슈퍼어드민: uhi1308@naver.com / Ghrnfldks12!!@
 * - 직원: aaa@naver.com / 111111
 */

interface UserSeed {
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'company_admin' | 'manager' | 'store_manager' | 'staff';
}

const SEED_USERS: UserSeed[] = [
  {
    email: 'uhi1308@naver.com',
    password: 'Ghrnfldks12!!@',
    name: '슈퍼 관리자',
    role: 'super_admin',
  },
  {
    email: 'aaa@naver.com',
    password: '111111',
    name: '테스트 직원',
    role: 'staff',
  },
];

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const results: { email: string; success: boolean; message: string }[] = [];

    for (const user of SEED_USERS) {
      try {
        // 1. Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        let authUserId: string;

        if (existingUser) {
          // User exists, use existing ID
          authUserId = existingUser.id;
          results.push({
            email: user.email,
            success: true,
            message: '이미 존재하는 사용자 (업데이트됨)',
          });
        } else {
          // Create new auth user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
          });

          if (authError) {
            results.push({
              email: user.email,
              success: false,
              message: `Auth 생성 실패: ${authError.message}`,
            });
            continue;
          }

          authUserId = authData.user.id;
        }

        // 2. Upsert user profile
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            auth_id: authUserId,
            email: user.email,
            name: user.name,
            role: user.role,
            status: 'ACTIVE',
          }, {
            onConflict: 'email',
            ignoreDuplicates: false
          });

        if (profileError) {
          results.push({
            email: user.email,
            success: false,
            message: `프로필 생성 실패: ${profileError.message}`,
          });
          continue;
        }

        if (!existingUser) {
          results.push({
            email: user.email,
            success: true,
            message: '생성 완료',
          });
        }
      } catch (error) {
        results.push({
          email: user.email,
          success: false,
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    const allSuccess = results.every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? '모든 사용자가 생성되었습니다.' : '일부 사용자 생성에 실패했습니다.',
      results,
      users: SEED_USERS.map(u => ({
        email: u.email,
        password: u.password,
        role: u.role,
      })),
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

// GET - 시드할 사용자 정보 조회
export async function GET() {
  return NextResponse.json({
    message: 'POST 요청으로 사용자를 생성하세요.',
    users: SEED_USERS.map(u => ({
      email: u.email,
      password: u.password,
      role: u.role,
      name: u.name,
    })),
  });
}
