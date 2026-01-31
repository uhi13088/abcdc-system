import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface CopyOptions {
  haccpSettings: boolean;      // HACCP 운영 설정
  equipmentSettings: boolean;  // 장비 온도 설정
  notificationSettings: boolean; // 알림 설정
  ccpDefinitions: boolean;     // CCP 정의 (회사 레벨이지만 매장별로 필요할 수 있음)
  zones: boolean;              // 구역 설정
}

export interface CopyRequest {
  sourceStoreId: string;
  copyOptions: CopyOptions;
}

export interface CopyResult {
  success: boolean;
  copied: {
    haccpSettings: number;
    equipmentSettings: number;
    notificationSettings: number;
    ccpDefinitions: number;
    zones: number;
  };
  errors: string[];
}

// POST /api/haccp/stores/copy - 다른 매장에서 설정 복사
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const adminClient = createAdminClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('company_id, store_id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!userProfile.store_id) {
      return NextResponse.json({ error: 'Store not specified' }, { status: 400 });
    }

    // 권한 확인 (manager 이상만 복사 가능)
    if (!['super_admin', 'company_admin', 'manager'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body: CopyRequest = await request.json();
    const { sourceStoreId, copyOptions } = body;

    if (!sourceStoreId) {
      return NextResponse.json({ error: 'Source store is required' }, { status: 400 });
    }

    // 원본 매장 확인 (같은 회사 소속인지)
    const { data: sourceStore } = await adminClient
      .from('stores')
      .select('id, company_id, name')
      .eq('id', sourceStoreId)
      .single();

    if (!sourceStore || sourceStore.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Source store not found or access denied' }, { status: 403 });
    }

    // 대상 매장 확인
    const { data: targetStore } = await adminClient
      .from('stores')
      .select('id, company_id, name')
      .eq('id', userProfile.store_id)
      .single();

    if (!targetStore || targetStore.company_id !== userProfile.company_id) {
      return NextResponse.json({ error: 'Target store not found or access denied' }, { status: 403 });
    }

    const result: CopyResult = {
      success: true,
      copied: {
        haccpSettings: 0,
        equipmentSettings: 0,
        notificationSettings: 0,
        ccpDefinitions: 0,
        zones: 0,
      },
      errors: [],
    };

    // 1. HACCP 설정 복사
    if (copyOptions.haccpSettings) {
      try {
        const { data: sourceSettings } = await adminClient
          .from('haccp_company_settings')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .eq('store_id', sourceStoreId)
          .single();

        if (sourceSettings) {
          // 대상 매장에 기존 설정이 있는지 확인
          const { data: existingSettings } = await adminClient
            .from('haccp_company_settings')
            .select('id')
            .eq('company_id', userProfile.company_id)
            .eq('store_id', userProfile.store_id)
            .single();

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, created_at, updated_at, store_id, ...settingsToCopy } = sourceSettings;

          if (existingSettings) {
            await adminClient
              .from('haccp_company_settings')
              .update({ ...settingsToCopy, updated_at: new Date().toISOString() })
              .eq('id', existingSettings.id);
          } else {
            await adminClient
              .from('haccp_company_settings')
              .insert({
                ...settingsToCopy,
                store_id: userProfile.store_id,
              });
          }
          result.copied.haccpSettings = 1;
        }
      } catch (error) {
        console.error('Error copying HACCP settings:', error);
        result.errors.push('HACCP 설정 복사 중 오류가 발생했습니다.');
      }
    }

    // 2. 장비 설정 복사
    if (copyOptions.equipmentSettings) {
      try {
        const { data: sourceEquipment } = await adminClient
          .from('company_equipment_settings')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .eq('store_id', sourceStoreId);

        if (sourceEquipment && sourceEquipment.length > 0) {
          // 대상 매장의 기존 장비 설정 삭제
          await adminClient
            .from('company_equipment_settings')
            .delete()
            .eq('company_id', userProfile.company_id)
            .eq('store_id', userProfile.store_id);

          // 새 설정 삽입
          const equipmentToCopy = sourceEquipment.map((eq) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, created_at, updated_at, store_id, ...rest } = eq;
            return {
              ...rest,
              store_id: userProfile.store_id,
            };
          });

          await adminClient
            .from('company_equipment_settings')
            .insert(equipmentToCopy);

          result.copied.equipmentSettings = sourceEquipment.length;
        }
      } catch (error) {
        console.error('Error copying equipment settings:', error);
        result.errors.push('장비 설정 복사 중 오류가 발생했습니다.');
      }
    }

    // 3. 알림 설정 복사
    if (copyOptions.notificationSettings) {
      try {
        const { data: sourceNotifications } = await adminClient
          .from('notification_settings')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .eq('store_id', sourceStoreId);

        if (sourceNotifications && sourceNotifications.length > 0) {
          for (const notification of sourceNotifications) {
            // 대상 매장에 같은 카테고리 설정이 있는지 확인
            const { data: existing } = await adminClient
              .from('notification_settings')
              .select('id')
              .eq('company_id', userProfile.company_id)
              .eq('store_id', userProfile.store_id)
              .eq('category', notification.category)
              .single();

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, created_at, updated_at, store_id, created_by, updated_by, ...settingsToCopy } = notification;

            if (existing) {
              await adminClient
                .from('notification_settings')
                .update({
                  ...settingsToCopy,
                  updated_at: new Date().toISOString(),
                  updated_by: userData.user.id,
                })
                .eq('id', existing.id);
            } else {
              await adminClient
                .from('notification_settings')
                .insert({
                  ...settingsToCopy,
                  store_id: userProfile.store_id,
                  created_by: userData.user.id,
                  updated_by: userData.user.id,
                });
            }
          }
          result.copied.notificationSettings = sourceNotifications.length;
        }
      } catch (error) {
        console.error('Error copying notification settings:', error);
        result.errors.push('알림 설정 복사 중 오류가 발생했습니다.');
      }
    }

    // 4. CCP 정의 복사 (store_id 기반인 경우)
    if (copyOptions.ccpDefinitions) {
      try {
        // CCP 정의가 store_id를 지원하는지 확인
        const { data: sourceCcp } = await adminClient
          .from('ccp_definitions')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .eq('store_id', sourceStoreId);

        if (sourceCcp && sourceCcp.length > 0) {
          // 대상 매장의 기존 CCP 정의 삭제 (주의: 관련 기록이 있을 수 있음)
          // 여기서는 기존 정의를 삭제하지 않고 추가만 함 (중복 체크)
          for (const ccp of sourceCcp) {
            const { data: existing } = await adminClient
              .from('ccp_definitions')
              .select('id')
              .eq('company_id', userProfile.company_id)
              .eq('store_id', userProfile.store_id)
              .eq('ccp_code', ccp.ccp_code)
              .single();

            if (!existing) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, created_at, updated_at, store_id, ...ccpToCopy } = ccp;
              await adminClient
                .from('ccp_definitions')
                .insert({
                  ...ccpToCopy,
                  store_id: userProfile.store_id,
                });
              result.copied.ccpDefinitions++;
            }
          }
        }
      } catch (error) {
        console.error('Error copying CCP definitions:', error);
        // CCP 정의가 store_id를 지원하지 않을 수 있음 - 무시
      }
    }

    // 5. 구역 설정 복사
    if (copyOptions.zones) {
      try {
        const { data: sourceZones } = await adminClient
          .from('haccp_zones')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .eq('store_id', sourceStoreId);

        if (sourceZones && sourceZones.length > 0) {
          for (const zone of sourceZones) {
            const { data: existing } = await adminClient
              .from('haccp_zones')
              .select('id')
              .eq('company_id', userProfile.company_id)
              .eq('store_id', userProfile.store_id)
              .eq('zone_code', zone.zone_code)
              .single();

            if (!existing) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, created_at, updated_at, store_id, ...zoneToCopy } = zone;
              await adminClient
                .from('haccp_zones')
                .insert({
                  ...zoneToCopy,
                  store_id: userProfile.store_id,
                });
              result.copied.zones++;
            }
          }
        }
      } catch (error) {
        console.error('Error copying zones:', error);
        // 구역 테이블이 없을 수 있음 - 무시
      }
    }

    // 결과 확인
    if (result.errors.length > 0 &&
        result.copied.haccpSettings === 0 &&
        result.copied.equipmentSettings === 0 &&
        result.copied.notificationSettings === 0) {
      result.success = false;
    }

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `${sourceStore.name}에서 설정을 복사했습니다.`
        : '일부 설정 복사에 실패했습니다.',
      copied: result.copied,
      errors: result.errors,
      sourceStoreName: sourceStore.name,
      targetStoreName: targetStore.name,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
