/**
 * 날짜/시간 유틸리티
 */

/**
 * 시간 문자열을 분으로 변환 ("09:30" -> 570)
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간 문자열로 변환 (570 -> "09:30")
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 두 시간 사이의 근무시간 계산 (분 단위)
 */
export function calculateWorkMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);

  // 야간 근무 (다음날로 넘어가는 경우)
  if (end < start) {
    end += 24 * 60;
  }

  return Math.max(0, end - start - breakMinutes);
}

/**
 * 근무시간을 시간 단위로 변환
 */
export function calculateWorkHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  const minutes = calculateWorkMinutes(startTime, endTime, breakMinutes);
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * 야간근로시간 계산 (22:00 ~ 06:00)
 */
export function calculateNightHours(startTime: string, endTime: string): number {
  const NIGHT_START = 22 * 60; // 22:00
  const NIGHT_END = 6 * 60;    // 06:00

  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);

  // 다음날로 넘어가는 경우
  if (end < start) {
    end += 24 * 60;
  }

  let nightMinutes = 0;

  // 22:00 ~ 24:00 구간
  if (start < 24 * 60 && end > NIGHT_START) {
    const nightStart = Math.max(start, NIGHT_START);
    const nightEnd = Math.min(end, 24 * 60);
    nightMinutes += nightEnd - nightStart;
  }

  // 00:00 ~ 06:00 구간
  if (end > 24 * 60) {
    const nightStart = 24 * 60;
    const nightEnd = Math.min(end, 24 * 60 + NIGHT_END);
    nightMinutes += nightEnd - nightStart;
  } else if (start < NIGHT_END) {
    const nightStart = Math.max(start, 0);
    const nightEnd = Math.min(end, NIGHT_END);
    nightMinutes += nightEnd - nightStart;
  }

  return Math.round((nightMinutes / 60) * 100) / 100;
}

/**
 * 연장근로시간 계산 (8시간 초과)
 */
export function calculateOvertimeHours(
  workHours: number,
  standardHours: number = 8
): number {
  return Math.max(0, workHours - standardHours);
}

/**
 * 주간 총 근무시간 계산
 */
export function calculateWeeklyHours(
  dailyHours: number[]
): {
  total: number;
  overtime: number;
  isOverLimit: boolean;
} {
  const total = dailyHours.reduce((sum, hours) => sum + hours, 0);
  const overtime = Math.max(0, total - 40);
  const isOverLimit = total > 52;

  return { total, overtime, isOverLimit };
}

/**
 * 한국 공휴일 체크 (기본 공휴일만, 매년 업데이트 필요)
 */
export function isKoreanHoliday(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 고정 공휴일
  const fixedHolidays = [
    { month: 1, day: 1 },   // 신정
    { month: 3, day: 1 },   // 삼일절
    { month: 5, day: 5 },   // 어린이날
    { month: 6, day: 6 },   // 현충일
    { month: 8, day: 15 },  // 광복절
    { month: 10, day: 3 },  // 개천절
    { month: 10, day: 9 },  // 한글날
    { month: 12, day: 25 }, // 성탄절
  ];

  return fixedHolidays.some(h => h.month === month && h.day === day);
}

/**
 * 요일 인덱스 반환 (0=일, 1=월, ..., 6=토)
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * 요일 이름 반환
 */
export function getDayName(dayIndex: number): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[dayIndex];
}

/**
 * 해당 월의 시작일과 종료일
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

/**
 * 두 날짜 사이의 일수
 */
export function daysBetween(start: Date, end: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((end.getTime() - start.getTime()) / oneDay));
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜/시간 포맷팅 (YYYY-MM-DD HH:mm)
 */
export function formatDateTime(date: Date): string {
  const dateStr = formatDate(date);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * 상대적 시간 표시 (n분 전, n시간 전, n일 전)
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDate(date);
}

/**
 * 한국어 날짜 포맷팅 (YYYY년 MM월 DD일)
 */
export function formatKoreanDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 한국어 날짜/시간 포맷팅 (YYYY년 MM월 DD일 HH시 mm분)
 */
export function formatKoreanDateTime(date: Date): string {
  const dateStr = formatKoreanDate(date);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${dateStr} ${hours}시 ${minutes}분`;
}
