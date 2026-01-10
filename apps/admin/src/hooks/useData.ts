'use client';

import { useRealtimeData, useRealtimeRecord } from './useRealtime';

// Types
export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  store_id: string;
  store?: Store;
  employment_type: 'full_time' | 'part_time' | 'contract';
  status: 'active' | 'inactive' | 'on_leave';
  hourly_wage?: number;
  monthly_salary?: number;
  hire_date: string;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager_id?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  employee?: Employee;
  date: string;
  check_in?: string;
  check_out?: string;
  status: 'present' | 'late' | 'early_leave' | 'absent' | 'holiday' | 'vacation';
  work_hours?: number;
  overtime_hours?: number;
  notes?: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  employee_id: string;
  employee?: Employee;
  store_id: string;
  store?: Store;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface Salary {
  id: string;
  employee_id: string;
  employee?: Employee;
  year: number;
  month: number;
  base_salary: number;
  overtime_pay: number;
  night_pay: number;
  holiday_pay: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  status: 'pending' | 'calculated' | 'paid';
  paid_at?: string;
  created_at: string;
}

export interface Approval {
  id: string;
  employee_id: string;
  employee?: Employee;
  type: 'vacation' | 'overtime' | 'expense' | 'schedule_change';
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  approver_id?: string;
  approved_at?: string;
  created_at: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author?: Employee;
  category: 'general' | 'urgent' | 'hr' | 'system';
  is_pinned: boolean;
  views: number;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  sender?: Employee;
  receiver_id: string;
  receiver?: Employee;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Contract {
  id: string;
  employee_id: string;
  employee?: Employee;
  type: 'full_time' | 'part_time' | 'contract';
  start_date: string;
  end_date?: string;
  salary_type: 'hourly' | 'monthly';
  salary_amount: number;
  status: 'active' | 'expired' | 'terminated';
  file_url?: string;
  created_at: string;
}

// Hooks
export function useEmployees(options?: { storeId?: string; status?: string }) {
  const filter: Record<string, any> = {};
  if (options?.storeId) filter.store_id = options.storeId;
  if (options?.status) filter.status = options.status;

  return useRealtimeData<Employee>('employees', {
    select: '*, store:stores(*)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'name', ascending: true },
  });
}

export function useEmployee(id: string | null) {
  return useRealtimeRecord<Employee>('employees', id, {
    select: '*, store:stores(*)',
  });
}

export function useStores() {
  return useRealtimeData<Store>('stores', {
    orderBy: { column: 'name', ascending: true },
  });
}

export function useStore(id: string | null) {
  return useRealtimeRecord<Store>('stores', id);
}

export function useAttendance(options?: { date?: string; employeeId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.date) filter.date = options.date;
  if (options?.employeeId) filter.employee_id = options.employeeId;

  return useRealtimeData<Attendance>('attendance', {
    select: '*, employee:employees(id, name, position, department)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useSchedules(options?: { date?: string; employeeId?: string; storeId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.date) filter.date = options.date;
  if (options?.employeeId) filter.employee_id = options.employeeId;
  if (options?.storeId) filter.store_id = options.storeId;

  return useRealtimeData<Schedule>('schedules', {
    select: '*, employee:employees(id, name, position), store:stores(id, name)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'date', ascending: true },
  });
}

export function useSalaries(options?: { year?: number; month?: number; employeeId?: string }) {
  const filter: Record<string, any> = {};
  if (options?.year) filter.year = options.year;
  if (options?.month) filter.month = options.month;
  if (options?.employeeId) filter.employee_id = options.employeeId;

  return useRealtimeData<Salary>('salaries', {
    select: '*, employee:employees(id, name, position, department)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useApprovals(options?: { status?: string; type?: string }) {
  const filter: Record<string, any> = {};
  if (options?.status) filter.status = options.status;
  if (options?.type) filter.type = options.type;

  return useRealtimeData<Approval>('approvals', {
    select: '*, employee:employees(id, name, position, department)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useNotices(options?: { category?: string; limit?: number }) {
  const filter: Record<string, any> = {};
  if (options?.category) filter.category = options.category;

  return useRealtimeData<Notice>('notices', {
    select: '*, author:employees(id, name)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
    limit: options?.limit,
  });
}

export function useMessages(options?: { userId?: string }) {
  return useRealtimeData<Message>('messages', {
    select: '*, sender:employees!sender_id(id, name), receiver:employees!receiver_id(id, name)',
    orderBy: { column: 'created_at', ascending: false },
  });
}

export function useContracts(options?: { employeeId?: string; status?: string }) {
  const filter: Record<string, any> = {};
  if (options?.employeeId) filter.employee_id = options.employeeId;
  if (options?.status) filter.status = options.status;

  return useRealtimeData<Contract>('contracts', {
    select: '*, employee:employees(id, name, position)',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });
}
