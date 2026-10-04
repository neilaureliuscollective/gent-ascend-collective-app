import { NextRequest, NextResponse } from 'next/server';
import { authorizedPerson } from '@/domains/access/authorize';
import { verifyOrigin } from '@/domains/intelligence/http';
import {
  ACCOUNT_COOKIE,
  FLOW_COOKIE,
  CUSTOMER_PATH,
  customerConfig,
  prepareCustomerConnection,
} from '@/domains/commerce/customer-account';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function POST(request: NextRequest) {
  try {
    verifyOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  }
  const owner = await authorizedPerson('profile.read');
  if (!owner)
    return NextResponse.redirect(new URL('/enter', request.url), { status: 303, headers });
  const config = customerConfig();
  if (!config || request.headers.get('origin') !== config.origin)
    return NextResponse.redirect(new URL(`${CUSTOMER_PATH}?connection=unavailable`, request.url), {
      status: 303,
      headers,
    });
  try {
    const prepared = await prepareCustomerConnection(owner.person.id, config);
    const response = NextResponse.redirect(prepared.location, 303);
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    response.cookies.set(FLOW_COOKIE, prepared.cookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    response.cookies.set(ACCOUNT_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL(`${CUSTOMER_PATH}?connection=failed`, request.url),
      303,
    );
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
}
export async function DELETE(request: NextRequest) {
  try {
    verifyOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  }
  if (!(await authorizedPerson('profile.read')))
    return NextResponse.json({ error: 'Sign in before disconnecting.' }, { status: 401, headers });
  const response = NextResponse.json({ disconnected: true }, { headers });
  for (const name of [FLOW_COOKIE, ACCOUNT_COOKIE])
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  return response;
}
