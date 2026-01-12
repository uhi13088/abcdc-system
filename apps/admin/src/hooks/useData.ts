'use client';

import { useRealtimeData, useRealtimeRecord } from './useRealtime';

// Types aligned with actual Supabase schema
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  role: 'super_admin' | 'company_admin' | 'manager' | 'store_manager' | 'team_leader' | 'staff';
  company_id?: string;
  brand_id?: string;
  store_id?: string;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  company_id: string;
  brand_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface Attendance {
  id: string;
  staff_id: string;
  user?: User;
  work_date: string;
  actual_check_in?: string;
  actual_check_out?: string;
  scheduled_check_in?: string;
  scheduled_check_out?: string;
  status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'VACATION' | 'EARLY_OUT';
  work_hours?: number;
  overtime_hours?: number;
  check_in_method?: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  staff_id: string;
  user?: User;
  store_id: string;
  store?: Store;
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  created_at: string;
}

export interface Salary {
  id: string;
  staff_id: string;
  user?: User;
  year: number;
  month: number;
  base_salary: number;
  overtime_pay: number;
  night_pay: number;
  holiday_pay: number;
  total_gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status: 'PENDING' | 'CONFIRMED' | 'PAID';
  paid_at?: string;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_role: string;
  type: 'LEAVE' | 'OVERTIME' | 'SCHEDULE_CHANGE' | 'PURCHASE' | 'DISPOSAL' | 'RESIGNATION' | 'ABSENCE_EXCUSE' | 'EXPENSE' | 'DOCUMENT' | 'OTHER';
  details: Record<string, any>;
  approval_line: Array<{
    order: number;
    approverId: string | null;
    approverRole: string;
    status: string;
  }>;
  current_step: number;
  final_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  company_id: string;
  created_at: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  created_by?: string;
  is_pinned: boolean;
  is_important: boolean;
  company_id?: string;
  published_at?: string;
  created_at: string;
}

export interface Contract {
  id: string;
  staff_id: string;
  user?: User;
  contract_type: string;
  start_date: string;
  end_date?: string;
  position?: string;
  department?: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'REJECTED';
  created_at: string;
}

// Hooks with correct table and column names
export function useUsers(options?: { storeId?: string; status?: string; role?: string }) {
  const filter: Record<string, any> = {};
  if (options?.storeId) filter.store_id = options.storeId;
  if (options?.status) filter.status = options.status;
  if (options?.role) filter.role = options.role;

  return useRealtimeData<User>('users', {
    select: '*',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'name', ascending: true },
  });
}

export function useUser(id: string | null) {
  return useRealtimeRecord<User>('users', id, {
    select: '*',
  });
}

export function useStores(options?: { companyId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.companyId) filter.company_id = options.companyId;

  return useRealtimeData<Store>('stores', {
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'name', ascending: true },
  });
}

export function useStore(id: string | null) {
  return useRealtimeRecord<Store>('stores', id);
}

export function useAttendances(options?: { workDate?: string; staffId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.workDate) filter.work_date = options.workDate;
  if (options?.staffId) filter.staff_id = options.staffId;

  return useRealtimeData<Attendance>('attendances', {
    select: '*, user:users(id, name, role)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useSchedules(options?: { workDate?: string; staffId?: string; storeId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.workDate) filter.work_date = options.workDate;
  if (options?.staffId) filter.staff_id = options.staffId;
  if (options?.storeId) filter.store_id = options.storeId;

  return useRealtimeData<Schedule>('schedules', {
    select: '*, user:users(id, name, role), store:stores(id, name)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'work_date', ascending: true },
  });
}

export function useSalaries(options?: { year?: number; month?: number; staffId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.year) filter.year = options.year;
  if (options?.month) filter.month = options.month;
  if (options?.staffId) filter.staff_id = options.staffId;

  return useRealtimeData<Salary>('salaries', {
    select: '*, user:users(id, name, role)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useApprovalRequests(options?: { finalStatus?: string; type?: string }) {
  const filter: Record<string, any> = {};
  if (options?.finalStatus) filter.final_status = options.finalStatus;
  if (options?.type) filter.type = options.type;

  return useRealtimeData<ApprovalRequest>('approval_requests', {
    select: '*',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useNotices(options?: { limit?: number }) {
  return useRealtimeData<Notice>('notices', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false },
    limit: options?.limit,
  });
}

export function useContracts(options?: { staffId?: string; status?: string }) {
  const filter: Record<string, any> = {};
  if (options?.staffId) filter.staff_id = options.staffId;
  if (options?.status) filter.status = options.status;

  return useRealtimeData<Contract>('contracts', {
    select: '*, user:users(id, name, role)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

// Legacy aliases for backward compatibility (deprecated)
/** @deprecated Use useUsers instead */
export const useEmployees = useUsers;
/** @deprecated Use useUser instead */
export const useEmployee = useUser;
/** @deprecated Use useAttendances instead */
export const useAttendance = useAttendances;
/** @deprecated Use useApprovalRequests instead */
export const useApprovals = useApprovalRequests;
