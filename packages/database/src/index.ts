// Supabase Client
export { supabase, supabaseAdmin, createServerClient } from './client';
export type { SupabaseClient, Database } from './client';

// Database Types
export type {
  Json,
} from './types';

// Re-export table types for convenience
export type { Database as DB } from './types';

// Helper type to get Row type from table name
type Tables = Database['public']['Tables'];
export type TableRow<T extends keyof Tables> = Tables[T]['Row'];
export type TableInsert<T extends keyof Tables> = Tables[T]['Insert'];
export type TableUpdate<T extends keyof Tables> = Tables[T]['Update'];

// Export specific entity types
import type { Database } from './types';

export type Company = Database['public']['Tables']['companies']['Row'];
export type Brand = Database['public']['Tables']['brands']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type Contract = Database['public']['Tables']['contracts']['Row'];
export type Attendance = Database['public']['Tables']['attendances']['Row'];
export type Salary = Database['public']['Tables']['salaries']['Row'];
export type Schedule = Database['public']['Tables']['schedules']['Row'];
export type ApprovalRequest = Database['public']['Tables']['approval_requests']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
export type LaborLawVersion = Database['public']['Tables']['labor_law_versions']['Row'];

// Insert types
export type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
export type BrandInsert = Database['public']['Tables']['brands']['Insert'];
export type StoreInsert = Database['public']['Tables']['stores']['Insert'];
export type TeamInsert = Database['public']['Tables']['teams']['Insert'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type ContractInsert = Database['public']['Tables']['contracts']['Insert'];
export type AttendanceInsert = Database['public']['Tables']['attendances']['Insert'];
export type SalaryInsert = Database['public']['Tables']['salaries']['Insert'];
export type ScheduleInsert = Database['public']['Tables']['schedules']['Insert'];

// View types
export type MonthlyAttendanceStats = Database['public']['Views']['monthly_attendance_stats']['Row'];
