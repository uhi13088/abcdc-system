import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/billing/callback/fail
 * 토스페이먼츠 빌링키 발급 실패 콜백
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code') || 'UNKNOWN_ERROR';
  const message = searchParams.get('message') || '결제 수단 등록에 실패했습니다';

  console.error('TossPayments billing failed:', { code, message });

  // Redirect to settings with error message
  return NextResponse.redirect(
    new URL(`/settings?tab=subscription&billing=error&message=${encodeURIComponent(message)}`, request.url)
  );
}
