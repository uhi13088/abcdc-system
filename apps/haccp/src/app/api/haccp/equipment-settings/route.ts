import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface MonitoringEquipment {
  id: string;
  key: string;
  name: string;
  type: 'freezer' | 'fridge';
  target_temp: number;
  enabled: boolean;
  location?: string;
  sensor_id?: string;
}

// GET /api/haccp/equipment-settings - 모니터링 장비 목록 조회
export async function GET() {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 회사의 장비 설정 조회
    const { data: settings, error } = await adminClient
      .from('company_equipment_settings')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('created_at', { ascending: true });

    if (error) {
      // 테이블이 없거나 데이터가 없으면 기본값 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('company_equipment_settings table does not exist');
        return NextResponse.json(getDefaultEquipment());
      }
      console.error('Error fetching equipment settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 설정이 없으면 기본값 반환
    if (!settings || settings.length === 0) {
      return NextResponse.json(getDefaultEquipment());
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/haccp/equipment-settings - 모니터링 장비 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 필수 필드 검증
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: '장비 이름과 유형은 필수입니다.' },
        { status: 400 }
      );
    }

    const key = body.key || body.name.replace(/\s+/g, '_');
    const targetTemp = body.type === 'freezer' ? -18 : 5;

    const equipmentData = {
      company_id: userProfile.company_id,
      key,
      name: body.name,
      type: body.type,
      target_temp: body.target_temp ?? targetTemp,
      enabled: body.enabled !== false,
      location: body.location || null,
      sensor_id: body.sensor_id || null,
    };

    const { data, error } = await adminClient
      .from('company_equipment_settings')
      .insert(equipmentData)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          error: '장비 설정 기능을 사용하려면 데이터베이스 마이그레이션이 필요합니다.'
        }, { status: 503 });
      }
      console.error('Error creating equipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/equipment-settings - 모니터링 장비 일괄 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();
    const body: { equipment: MonitoringEquipment[] } = await request.json();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 기존 설정 삭제
    await adminClient
      .from('company_equipment_settings')
      .delete()
      .eq('company_id', userProfile.company_id);

    // 새 설정 삽입
    const equipmentData = body.equipment.map((eq) => ({
      company_id: userProfile.company_id,
      key: eq.key || eq.name.replace(/\s+/g, '_'),
      name: eq.name,
      type: eq.type,
      target_temp: eq.target_temp,
      enabled: eq.enabled !== false,
      location: eq.location || null,
      sensor_id: eq.sensor_id || null,
    }));

    const { data, error } = await adminClient
      .from('company_equipment_settings')
      .insert(equipmentData)
      .select();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          error: '장비 설정 기능을 사용하려면 데이터베이스 마이그레이션이 필요합니다.'
        }, { status: 503 });
      }
      console.error('Error updating equipment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 기본 모니터링 장비 목록
function getDefaultEquipment(): MonitoringEquipment[] {
  return [
    { id: '1', key: '냉동창고', name: '냉동창고', type: 'freezer', target_temp: -18, enabled: true },
    { id: '2', key: '배합실_냉장고', name: '배합실 냉장고', type: 'fridge', target_temp: 5, enabled: true },
    { id: '3', key: '내포장실_냉장고', name: '내포장실 냉장고', type: 'fridge', target_temp: 5, enabled: true },
    { id: '4', key: '내포장실_냉동고', name: '내포장실 냉동고', type: 'freezer', target_temp: -18, enabled: true },
  ];
}
