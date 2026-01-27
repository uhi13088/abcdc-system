import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface CompanySettings {
  company_name: string;
  business_number: string;
  representative: string;
  address: string;
  phone: string;
  haccp_certification_number: string | null;
  certification_date: string | null;
  certification_expiry: string | null;
}

interface NotificationSettings {
  ccp_alert_enabled: boolean;
  ccp_deviation_notification: boolean;
  daily_report_enabled: boolean;
  daily_report_time: string;
  inspection_reminder: boolean;
  inspection_reminder_hours: number;
  training_reminder: boolean;
  email_notifications: boolean;
  notification_email: string | null;
}

interface HaccpSettings {
  auto_logout_minutes: number;
  require_photo_evidence: boolean;
  allow_late_entry: boolean;
  late_entry_hours: number;
  require_corrective_action: boolean;
  ccp_monitoring_interval: number;
  temperature_unit: string;
  record_retention_years: number;
}

// 역할 계층 정의 (높은 권한 → 낮은 권한)
const ROLE_HIERARCHY = [
  'super_admin',
  'company_admin',
  'manager',
  'store_manager',
  'team_leader',
  'staff',
] as const;

type UserRole = typeof ROLE_HIERARCHY[number];

interface VerificationSettings {
  verification_min_role: UserRole;
  allow_self_verification: boolean;
  verification_roles_by_type: Record<string, UserRole>;
}

// GET /api/haccp/settings - 설정 조회
export async function GET() {
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

    // 회사 정보 조회
    const { data: company } = await supabase
      .from('companies')
      .select('name, business_number, ceo_name, address, phone, haccp_certification_number, haccp_certification_date, haccp_certification_expiry')
      .eq('id', userProfile.company_id)
      .single();

    // HACCP 설정 조회
    const { data: haccpSettings } = await supabase
      .from('haccp_company_settings')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .single();

    // 기본값 설정
    const defaultNotificationSettings: NotificationSettings = {
      ccp_alert_enabled: true,
      ccp_deviation_notification: true,
      daily_report_enabled: true,
      daily_report_time: '18:00',
      inspection_reminder: true,
      inspection_reminder_hours: 2,
      training_reminder: true,
      email_notifications: true,
      notification_email: null,
    };

    const defaultHaccpSettings: HaccpSettings = {
      auto_logout_minutes: 30,
      require_photo_evidence: true,
      allow_late_entry: false,
      late_entry_hours: 24,
      require_corrective_action: true,
      ccp_monitoring_interval: 60,
      temperature_unit: 'celsius',
      record_retention_years: 3,
    };

    const defaultVerificationSettings: VerificationSettings = {
      verification_min_role: 'manager',
      allow_self_verification: false,
      verification_roles_by_type: {},
    };

    const companySettings: CompanySettings = {
      company_name: company?.name || '',
      business_number: company?.business_number || '',
      representative: company?.ceo_name || '',
      address: company?.address || '',
      phone: company?.phone || '',
      haccp_certification_number: company?.haccp_certification_number || null,
      certification_date: company?.haccp_certification_date || null,
      certification_expiry: company?.haccp_certification_expiry || null,
    };

    const notificationSettings: NotificationSettings = haccpSettings ? {
      ccp_alert_enabled: haccpSettings.ccp_alert_enabled ?? defaultNotificationSettings.ccp_alert_enabled,
      ccp_deviation_notification: haccpSettings.ccp_deviation_notification ?? defaultNotificationSettings.ccp_deviation_notification,
      daily_report_enabled: haccpSettings.daily_report_enabled ?? defaultNotificationSettings.daily_report_enabled,
      daily_report_time: haccpSettings.daily_report_time || defaultNotificationSettings.daily_report_time,
      inspection_reminder: haccpSettings.inspection_reminder ?? defaultNotificationSettings.inspection_reminder,
      inspection_reminder_hours: haccpSettings.inspection_reminder_hours ?? defaultNotificationSettings.inspection_reminder_hours,
      training_reminder: haccpSettings.training_reminder ?? defaultNotificationSettings.training_reminder,
      email_notifications: haccpSettings.email_notifications ?? defaultNotificationSettings.email_notifications,
      notification_email: haccpSettings.notification_email || null,
    } : defaultNotificationSettings;

    const operationalSettings: HaccpSettings = haccpSettings ? {
      auto_logout_minutes: haccpSettings.auto_logout_minutes ?? defaultHaccpSettings.auto_logout_minutes,
      require_photo_evidence: haccpSettings.require_photo_evidence ?? defaultHaccpSettings.require_photo_evidence,
      allow_late_entry: haccpSettings.allow_late_entry ?? defaultHaccpSettings.allow_late_entry,
      late_entry_hours: haccpSettings.late_entry_hours ?? defaultHaccpSettings.late_entry_hours,
      require_corrective_action: haccpSettings.require_corrective_action ?? defaultHaccpSettings.require_corrective_action,
      ccp_monitoring_interval: haccpSettings.ccp_monitoring_interval ?? defaultHaccpSettings.ccp_monitoring_interval,
      temperature_unit: haccpSettings.temperature_unit || defaultHaccpSettings.temperature_unit,
      record_retention_years: haccpSettings.record_retention_years ?? defaultHaccpSettings.record_retention_years,
    } : defaultHaccpSettings;

    const verificationSettings: VerificationSettings = haccpSettings ? {
      verification_min_role: haccpSettings.verification_min_role || defaultVerificationSettings.verification_min_role,
      allow_self_verification: haccpSettings.allow_self_verification ?? defaultVerificationSettings.allow_self_verification,
      verification_roles_by_type: haccpSettings.verification_roles_by_type || defaultVerificationSettings.verification_roles_by_type,
    } : defaultVerificationSettings;

    return NextResponse.json({
      companySettings,
      notificationSettings,
      haccpSettings: operationalSettings,
      verificationSettings,
      roleHierarchy: ROLE_HIERARCHY,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/haccp/settings - 설정 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

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

    // 권한 확인 (관리자만 수정 가능)
    if (!['super_admin', 'company_admin', 'manager'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { companySettings, notificationSettings, haccpSettings, verificationSettings } = body;

    // 회사 정보 업데이트
    if (companySettings) {
      const companyUpdate: Record<string, unknown> = {};
      if (companySettings.company_name !== undefined) companyUpdate.name = companySettings.company_name;
      if (companySettings.business_number !== undefined) companyUpdate.business_number = companySettings.business_number;
      if (companySettings.representative !== undefined) companyUpdate.ceo_name = companySettings.representative;
      if (companySettings.address !== undefined) companyUpdate.address = companySettings.address;
      if (companySettings.phone !== undefined) companyUpdate.phone = companySettings.phone;
      if (companySettings.haccp_certification_number !== undefined) companyUpdate.haccp_certification_number = companySettings.haccp_certification_number;
      if (companySettings.certification_date !== undefined) companyUpdate.haccp_certification_date = companySettings.certification_date || null;
      if (companySettings.certification_expiry !== undefined) companyUpdate.haccp_certification_expiry = companySettings.certification_expiry || null;

      if (Object.keys(companyUpdate).length > 0) {
        const { error: companyError } = await supabase
          .from('companies')
          .update(companyUpdate)
          .eq('id', userProfile.company_id);

        if (companyError) {
          console.error('Error updating company:', companyError);
          return NextResponse.json({ error: companyError.message }, { status: 500 });
        }
      }
    }

    // HACCP 설정 업데이트 (알림, 운영, 검증 설정)
    if (notificationSettings || haccpSettings || verificationSettings) {
      const haccpSettingsData: Record<string, unknown> = {
        company_id: userProfile.company_id,
      };

      // 알림 설정
      if (notificationSettings) {
        if (notificationSettings.ccp_alert_enabled !== undefined) haccpSettingsData.ccp_alert_enabled = notificationSettings.ccp_alert_enabled;
        if (notificationSettings.ccp_deviation_notification !== undefined) haccpSettingsData.ccp_deviation_notification = notificationSettings.ccp_deviation_notification;
        if (notificationSettings.daily_report_enabled !== undefined) haccpSettingsData.daily_report_enabled = notificationSettings.daily_report_enabled;
        if (notificationSettings.daily_report_time !== undefined) haccpSettingsData.daily_report_time = notificationSettings.daily_report_time;
        if (notificationSettings.inspection_reminder !== undefined) haccpSettingsData.inspection_reminder = notificationSettings.inspection_reminder;
        if (notificationSettings.inspection_reminder_hours !== undefined) haccpSettingsData.inspection_reminder_hours = notificationSettings.inspection_reminder_hours;
        if (notificationSettings.training_reminder !== undefined) haccpSettingsData.training_reminder = notificationSettings.training_reminder;
        if (notificationSettings.email_notifications !== undefined) haccpSettingsData.email_notifications = notificationSettings.email_notifications;
        if (notificationSettings.notification_email !== undefined) haccpSettingsData.notification_email = notificationSettings.notification_email;
      }

      // HACCP 운영 설정
      if (haccpSettings) {
        if (haccpSettings.auto_logout_minutes !== undefined) haccpSettingsData.auto_logout_minutes = haccpSettings.auto_logout_minutes;
        if (haccpSettings.require_photo_evidence !== undefined) haccpSettingsData.require_photo_evidence = haccpSettings.require_photo_evidence;
        if (haccpSettings.allow_late_entry !== undefined) haccpSettingsData.allow_late_entry = haccpSettings.allow_late_entry;
        if (haccpSettings.late_entry_hours !== undefined) haccpSettingsData.late_entry_hours = haccpSettings.late_entry_hours;
        if (haccpSettings.require_corrective_action !== undefined) haccpSettingsData.require_corrective_action = haccpSettings.require_corrective_action;
        if (haccpSettings.ccp_monitoring_interval !== undefined) haccpSettingsData.ccp_monitoring_interval = haccpSettings.ccp_monitoring_interval;
        if (haccpSettings.temperature_unit !== undefined) haccpSettingsData.temperature_unit = haccpSettings.temperature_unit;
        if (haccpSettings.record_retention_years !== undefined) haccpSettingsData.record_retention_years = haccpSettings.record_retention_years;
      }

      // 검증 권한 설정
      if (verificationSettings) {
        if (verificationSettings.verification_min_role !== undefined) haccpSettingsData.verification_min_role = verificationSettings.verification_min_role;
        if (verificationSettings.allow_self_verification !== undefined) haccpSettingsData.allow_self_verification = verificationSettings.allow_self_verification;
        if (verificationSettings.verification_roles_by_type !== undefined) haccpSettingsData.verification_roles_by_type = verificationSettings.verification_roles_by_type;
      }

      // 기존 설정 확인
      const { data: existingSettings } = await supabase
        .from('haccp_company_settings')
        .select('id')
        .eq('company_id', userProfile.company_id)
        .single();

      if (existingSettings) {
        // 기존 설정 업데이트
        const { error: updateError } = await supabase
          .from('haccp_company_settings')
          .update(haccpSettingsData)
          .eq('company_id', userProfile.company_id);

        if (updateError) {
          console.error('Error updating HACCP settings:', updateError);
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      } else {
        // 새 설정 생성
        const { error: insertError } = await supabase
          .from('haccp_company_settings')
          .insert(haccpSettingsData);

        if (insertError) {
          console.error('Error creating HACCP settings:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
