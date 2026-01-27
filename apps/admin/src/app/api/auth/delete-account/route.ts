import { NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// DELETE /api/auth/delete-account - 계정 삭제
export async function DELETE() {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is company admin - they need special handling
    if (userProfile.role === 'company_admin' || userProfile.role === 'super_admin') {
      // Check if there are other admins in the company
      const { data: otherAdmins, error: adminError } = await adminClient
        .from('users')
        .select('id')
        .eq('company_id', userProfile.company_id)
        .in('role', ['company_admin', 'super_admin'])
        .neq('id', userProfile.id);

      if (adminError) {
        console.error('Error checking other admins:', adminError);
        return NextResponse.json({ error: '관리자 확인 중 오류가 발생했습니다.' }, { status: 500 });
      }

      // If no other admins, we need to delete the whole company
      if (!otherAdmins || otherAdmins.length === 0) {
        // Delete company (cascade will delete users)
        const { error: companyDeleteError } = await adminClient
          .from('companies')
          .delete()
          .eq('id', userProfile.company_id);

        if (companyDeleteError) {
          console.error('Error deleting company:', companyDeleteError);
          return NextResponse.json({ error: '회사 삭제 중 오류가 발생했습니다.' }, { status: 500 });
        }
      }
    }

    // Delete user from users table
    const { error: userDeleteError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userProfile.id);

    if (userDeleteError) {
      console.error('Error deleting user:', userDeleteError);
      return NextResponse.json({ error: '사용자 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // Delete auth user using admin API
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(
      userData.user.id
    );

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      // User record is already deleted, so we can still consider this a success
    }

    return NextResponse.json({ success: true, message: '계정이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: '계정 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
