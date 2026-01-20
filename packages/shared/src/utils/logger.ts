/**
 * 조건부 로깅 유틸리티
 * 개발 환경에서만 로그를 출력하고, 프로덕션에서는 무시합니다.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * 일반 로그 (개발 환경에서만 출력)
   */
  log: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * 정보 로그 (개발 환경에서만 출력)
   */
  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * 경고 로그 (항상 출력)
   */
  warn: (...args: unknown[]): void => {
    console.warn('[WARN]', ...args);
  },

  /**
   * 에러 로그 (항상 출력)
   */
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  },

  /**
   * 디버그 로그 (개발 환경에서만 출력)
   */
  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  },
};

export default logger;
