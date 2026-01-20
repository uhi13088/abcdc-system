/**
 * 날짜 유틸리티 함수들 (서버 사이드용)
 * Vercel 서버는 UTC를 사용하므로 한국 시간대를 명시적으로 처리해야 함
 */

/**
 * 한국 시간대 기준 현재 날짜 문자열 반환 (YYYY-MM-DD)
 */
export function getKoreaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

/**
 * 한국 시간대 기준 날짜 문자열 생성 (YYYY-MM-DD)
 */
export function formatKoreaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

/**
 * 한국 시간대 기준 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
export function getTodayKorea(): string {
  return getKoreaDateString(new Date());
}
