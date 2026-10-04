import { NextRequest, NextResponse } from 'next/server';
import { DELETE } from '../route';
import { CUSTOMER_PATH } from '@/domains/commerce/customer-account';
export async function POST(request: NextRequest) {
  const result = await DELETE(request);
  if (!result.ok) return result;
  const response = NextResponse.redirect(new URL(CUSTOMER_PATH, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  for (const cookie of result.cookies.getAll()) response.cookies.set(cookie);
  return response;
}
