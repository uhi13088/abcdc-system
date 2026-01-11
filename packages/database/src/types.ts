/**
 * Supabase Database Types
 * Auto-generated with: pnpm db:generate
 *
 * This is a placeholder. Run `pnpm db:generate` after Supabase is set up
 * to generate actual types from your database schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          business_number: string | null;
          ceo_name: string | null;
          address: string | null;
          phone: string | null;
          subscription_plan_id: string | null;
          status: 'ACTIVE' | 'INACTIVE';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_number?: string | null;
          ceo_name?: string | null;
          address?: string | null;
          phone?: string | null;
          subscription_plan_id?: string | null;
          status?: 'ACTIVE' | 'INACTIVE';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_number?: string | null;
          ceo_name?: string | null;
          address?: string | null;
          phone?: string | null;
          subscription_plan_id?: string | null;
          status?: 'ACTIVE' | 'INACTIVE';
          created_at?: string;
          updated_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          logo_url: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          logo_url?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          logo_url?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      stores: {
        Row: {
          id: string;
          company_id: string;
          brand_id: string;
          name: string;
          address: string | null;
          phone: string | null;
          latitude: number | null;
          longitude: number | null;
          allowed_radius: number;
          early_checkin_minutes: number;
          early_checkout_minutes: number;
          default_hourly_rate: number | null;
          qr_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          brand_id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          allowed_radius?: number;
          early_checkin_minutes?: number;
          early_checkout_minutes?: number;
          default_hourly_rate?: number | null;
          qr_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          brand_id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          allowed_radius?: number;
          early_checkin_minutes?: number;
          early_checkout_minutes?: number;
          default_hourly_rate?: number | null;
          qr_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          company_id: string;
          brand_id: string;
          store_id: string;
          name: string;
          leader_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          brand_id: string;
          store_id: string;
          name: string;
          leader_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          brand_id?: string;
          store_id?: string;
          name?: string;
          leader_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string;
          name: string;
          role: 'super_admin' | 'company_admin' | 'manager' | 'store_manager' | 'team_leader' | 'staff';
          company_id: string | null;
          brand_id: string | null;
          store_id: string | null;
          team_id: string | null;
          phone: string | null;
          address: string | null;
          birth_date: string | null;
          ssn_encrypted: string | null;
          position: string | null;
          bank_name: string | null;
          bank_account: string | null;
          account_holder: string | null;
          status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          avatar_url: string | null;
          fcm_token: string | null;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          email: string;
          name: string;
          role: 'super_admin' | 'company_admin' | 'manager' | 'store_manager' | 'team_leader' | 'staff';
          company_id?: string | null;
          brand_id?: string | null;
          store_id?: string | null;
          team_id?: string | null;
          phone?: string | null;
          address?: string | null;
          birth_date?: string | null;
          ssn_encrypted?: string | null;
          position?: string | null;
          bank_name?: string | null;
          bank_account?: string | null;
          account_holder?: string | null;
          status?: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          avatar_url?: string | null;
          fcm_token?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          email?: string;
          name?: string;
          role?: 'super_admin' | 'company_admin' | 'manager' | 'store_manager' | 'team_leader' | 'staff';
          company_id?: string | null;
          brand_id?: string | null;
          store_id?: string | null;
          team_id?: string | null;
          phone?: string | null;
          address?: string | null;
          birth_date?: string | null;
          ssn_encrypted?: string | null;
          position?: string | null;
          bank_name?: string | null;
          bank_account?: string | null;
          account_holder?: string | null;
          status?: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          avatar_url?: string | null;
          fcm_token?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
      };
      contracts: {
        Row: {
          id: string;
          contract_number: string;
          staff_id: string;
          company_id: string;
          brand_id: string;
          store_id: string;
          contract_type: '정규직' | '계약직' | '아르바이트' | '인턴' | null;
          start_date: string;
          end_date: string | null;
          probation_months: number | null;
          work_schedules: Json;
          position: string | null;
          department: string | null;
          duties: string[] | null;
          salary_config: Json;
          deduction_config: Json;
          standard_hours_per_week: number;
          standard_hours_per_day: number;
          break_minutes: number;
          annual_leave_days: number;
          paid_leave_days: number;
          sick_leave_days: number;
          benefits: Json | null;
          terms: Json | null;
          termination_config: Json | null;
          employee_signed_at: string | null;
          employee_signature: string | null;
          employer_signed_at: string | null;
          employer_signature: string | null;
          attachments: Json | null;
          status: 'DRAFT' | 'SENT' | 'SIGNED' | 'REJECTED';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contracts']['Row'], 'id' | 'contract_number' | 'created_at' | 'updated_at'> & {
          id?: string;
          contract_number?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>;
      };
      attendances: {
        Row: {
          id: string;
          staff_id: string;
          company_id: string;
          brand_id: string;
          store_id: string;
          work_date: string;
          scheduled_check_in: string | null;
          scheduled_check_out: string | null;
          actual_check_in: string | null;
          actual_check_out: string | null;
          status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'VACATION' | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          check_in_method: 'QR' | 'GEOFENCE' | 'BEACON' | 'MANUAL' | null;
          work_hours: number | null;
          break_hours: number | null;
          overtime_hours: number | null;
          night_hours: number | null;
          holiday_hours: number | null;
          base_pay: number | null;
          overtime_pay: number | null;
          night_pay: number | null;
          holiday_pay: number | null;
          daily_total: number | null;
          anomalies: Json | null;
          extensions: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['attendances']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendances']['Insert']>;
      };
      salaries: {
        Row: {
          id: string;
          staff_id: string;
          company_id: string;
          year: number;
          month: number;
          base_salary: number;
          overtime_pay: number;
          night_pay: number;
          holiday_pay: number;
          weekly_holiday_pay: number;
          meal_allowance: number;
          transport_allowance: number;
          position_allowance: number;
          other_allowances: Json | null;
          total_gross_pay: number | null;
          national_pension: number;
          health_insurance: number;
          long_term_care: number;
          employment_insurance: number;
          income_tax: number;
          local_income_tax: number;
          other_deductions: Json | null;
          total_deductions: number | null;
          net_pay: number | null;
          work_days: number | null;
          total_hours: number | null;
          status: 'PENDING' | 'CONFIRMED' | 'PAID';
          confirmed_at: string | null;
          confirmed_by: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['salaries']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['salaries']['Insert']>;
      };
      schedules: {
        Row: {
          id: string;
          staff_id: string;
          team_id: string | null;
          company_id: string;
          brand_id: string;
          store_id: string;
          work_date: string;
          start_time: string;
          end_time: string;
          break_minutes: number;
          status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
          generated_by: 'AI' | 'MANUAL' | 'CONTRACT' | null;
          ai_confidence: number | null;
          trade_request: Json | null;
          extensions: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['schedules']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schedules']['Insert']>;
      };
      approval_requests: {
        Row: {
          id: string;
          type: 'LEAVE' | 'OVERTIME' | 'SCHEDULE_CHANGE' | 'PURCHASE' | 'DISPOSAL' | 'RESIGNATION' | 'ABSENCE_EXCUSE' | 'EXPENSE' | 'DOCUMENT' | 'OTHER';
          requester_id: string;
          requester_name: string | null;
          requester_role: string | null;
          company_id: string;
          brand_id: string | null;
          store_id: string | null;
          approval_line: Json;
          current_step: number;
          final_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
          details: Json;
          attachments: Json | null;
          created_at: string;
          updated_at: string;
          finalized_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['approval_requests']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['approval_requests']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          category: 'ATTENDANCE' | 'SALARY' | 'SCHEDULE' | 'APPROVAL' | 'EMERGENCY_SHIFT' | 'CONTRACT' | 'NOTICE' | 'MESSAGE' | 'SYSTEM';
          priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
          title: string;
          body: string;
          image_url: string | null;
          actions: Json | null;
          deep_link: string | null;
          data: Json | null;
          sent: boolean;
          sent_at: string | null;
          read: boolean;
          read_at: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          sender_name: string | null;
          sender_role: string | null;
          recipient_id: string;
          recipient_name: string | null;
          recipient_role: string | null;
          subject: string | null;
          body: string;
          attachments: Json | null;
          status: 'SENT' | 'READ' | 'REPLIED';
          read_at: string | null;
          reply_to: string | null;
          has_replies: boolean;
          reply_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          display_name: string | null;
          price_monthly: number;
          price_yearly: number;
          limits: Json | null;
          features: Json | null;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscription_plans']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['subscription_plans']['Insert']>;
      };
      labor_law_versions: {
        Row: {
          id: string;
          version: string;
          effective_date: string;
          source: string | null;
          minimum_wage_hourly: number;
          standard_daily_hours: number;
          standard_weekly_hours: number;
          max_weekly_hours: number;
          overtime_rate: number;
          night_rate: number;
          holiday_rate: number;
          national_pension_rate: number;
          health_insurance_rate: number;
          long_term_care_rate: number;
          employment_insurance_rate: number;
          status: 'DRAFT' | 'VERIFIED' | 'ACTIVE' | 'ARCHIVED';
          verified_by: string | null;
          verified_at: string | null;
          changelog: string | null;
          previous_version_id: string | null;
          created_at: string;
          activated_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['labor_law_versions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['labor_law_versions']['Insert']>;
      };
    };
    Views: {
      monthly_attendance_stats: {
        Row: {
          staff_id: string | null;
          company_id: string | null;
          store_id: string | null;
          year: number | null;
          month: number | null;
          total_days: number | null;
          normal_days: number | null;
          late_days: number | null;
          early_leave_days: number | null;
          absent_days: number | null;
          vacation_days: number | null;
          total_work_hours: number | null;
          total_overtime_hours: number | null;
          total_night_hours: number | null;
          total_holiday_hours: number | null;
          total_pay: number | null;
        };
      };
    };
    Functions: {
      get_current_company_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      calculate_monthly_salary: {
        Args: {
          p_staff_id: string;
          p_year: number;
          p_month: number;
        };
        Returns: Database['public']['Tables']['salaries']['Row'];
      };
    };
    Enums: Record<string, never>;
  };
}
