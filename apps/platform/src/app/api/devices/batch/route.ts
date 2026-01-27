import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - 배치 목록 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: batches, error } = await adminClient
      .from('esp32_device_batches')
      .select(`
        *,
        created_by_user:users!esp32_device_batches_created_by_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching batches:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 각 배치별 통계 계산
    const batchesWithStats = await Promise.all(
      (batches || []).map(async (batch) => {
        const { count: registeredCount } = await adminClient
          .from('esp32_devices')
          .select('*', { count: 'exact', head: true })
          .like('device_serial', `${batch.serial_prefix}%`)
          .not('company_id', 'is', null);

        return {
          ...batch,
          registered_count: registeredCount || 0,
          unregistered_count: batch.quantity - (registeredCount || 0)
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: batchesWithStats
    });
  } catch (error) {
    console.error('Error in batch GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}

// POST - 기기 배치 생성 (대량 생성)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('users')
      .select('role, id')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { batch_name, device_type, quantity, serial_prefix, description } = body;

    // 유효성 검사
    if (!batch_name || !device_type || !quantity || !serial_prefix) {
      return NextResponse.json(
        { error: 'batch_name, device_type, quantity, serial_prefix are required' },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: 'quantity must be between 1 and 1000' },
        { status: 400 }
      );
    }

    // 데이터베이스 함수로 배치 생성
    const { data: batchResult, error: rpcError } = await adminClient.rpc('create_device_batch', {
      p_batch_name: batch_name,
      p_device_type: device_type,
      p_quantity: quantity,
      p_serial_prefix: serial_prefix,
      p_created_by: profile.id
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      // RPC 함수가 없을 경우 직접 생성
      return await createBatchManually(adminClient, {
        batch_name,
        device_type,
        quantity,
        serial_prefix,
        description,
        created_by: profile.id
      });
    }

    const result = batchResult?.[0] || batchResult;

    // 생성된 기기 목록 조회
    const { data: devices } = await adminClient
      .from('esp32_devices')
      .select('id, device_serial, registration_code, device_type, status')
      .like('device_serial', `${serial_prefix}%`)
      .order('device_serial', { ascending: true })
      .limit(quantity);

    return NextResponse.json({
      success: true,
      data: {
        batch_id: result?.batch_id,
        batch_code: result?.batch_code,
        devices_created: result?.devices_created || quantity,
        devices: devices || []
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error in batch POST:', error);
    return NextResponse.json(
      { error: 'Failed to create device batch' },
      { status: 500 }
    );
  }
}

// RPC 함수가 없을 경우 수동 배치 생성
async function createBatchManually(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    batch_name: string;
    device_type: string;
    quantity: number;
    serial_prefix: string;
    description?: string;
    created_by: string;
  }
) {
  const { batch_name, device_type, quantity, serial_prefix, description, created_by } = params;

  // 배치 코드 생성
  const batchCode = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

  // 기존 시리얼 번호 최대값 조회
  const { data: existingDevices } = await adminClient
    .from('esp32_devices')
    .select('device_serial')
    .like('device_serial', `${serial_prefix}%`)
    .order('device_serial', { ascending: false })
    .limit(1);

  let serialStart = 1;
  if (existingDevices && existingDevices.length > 0) {
    const lastSerial = existingDevices[0].device_serial;
    const lastNum = parseInt(lastSerial.replace(serial_prefix, ''), 10);
    serialStart = lastNum + 1;
  }

  const serialEnd = serialStart + quantity - 1;

  // 배치 레코드 생성
  const { data: batch, error: batchError } = await adminClient
    .from('esp32_device_batches')
    .insert({
      batch_name,
      batch_code: batchCode,
      device_type,
      quantity,
      serial_prefix,
      serial_start: serialStart,
      serial_end: serialEnd,
      description,
      created_by
    })
    .select()
    .single();

  if (batchError) {
    console.error('Error creating batch:', batchError);
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  // 기기들 생성
  const devices = [];
  for (let i = serialStart; i <= serialEnd; i++) {
    const deviceSerial = `${serial_prefix}${String(i).padStart(6, '0')}`;
    const registrationCode = generateRegistrationCode();
    const apiKey = generateApiKey();

    devices.push({
      device_serial: deviceSerial,
      registration_code: registrationCode,
      registration_code_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      device_type,
      api_key: apiKey,
      created_by
    });
  }

  const { data: createdDevices, error: devicesError } = await adminClient
    .from('esp32_devices')
    .insert(devices)
    .select('id, device_serial, registration_code, device_type, status');

  if (devicesError) {
    console.error('Error creating devices:', devicesError);
    return NextResponse.json({ error: devicesError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      batch_id: batch.id,
      batch_code: batchCode,
      devices_created: createdDevices?.length || 0,
      devices: createdDevices || []
    }
  }, { status: 201 });
}

function generateRegistrationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
