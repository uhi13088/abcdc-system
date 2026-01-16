import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// POST /api/integrations/toss-pos/disconnect - Toss POS 연결 해제
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Only admins can disconnect
    if (!['super_admin', 'company_admin', 'manager'].includes(userProfile.role || '')) {
      return NextResponse.json({ error: '연결 해제 권한이 없습니다.' }, { status: 403 });
    }

    // Find and deactivate the integration
    const { data: integration, error: findError } = await supabase
      .from('integrations')
      .select('id, access_token')
      .eq('company_id', userProfile.company_id)
      .eq('integration_type', 'TOSS_POS')
      .single();

    if (findError || !integration) {
      return NextResponse.json({ error: '연결된 Toss POS가 없습니다.' }, { status: 404 });
    }

    // Revoke token if exists (optional - depends on Toss API)
    if (integration.access_token) {
      try {
        // Attempt to revoke the token with Toss API
        await fetch('https://api.tosspayments.com/v1/oauth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${integration.access_token}`,
          },
        });
      } catch (revokeError) {
        console.log('Token revoke failed (may already be invalid):', revokeError);
      }
    }

    // Deactivate the integration
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        disconnected_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (updateError) {
      return NextResponse.json({ error: '연결 해제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Toss POS 연결이 해제되었습니다.',
    });
  } catch (error) {
    console.error('Toss POS disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
