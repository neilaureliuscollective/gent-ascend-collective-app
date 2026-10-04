import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authorizedPerson } from '@/domains/access/authorize';
import {
  ACCOUNT_COOKIE,
  FLOW_COOKIE,
  CUSTOMER_PATH,
  customerConfig,
  completeCustomerConnection,
  validateCustomerFlow,
} from '@/domains/commerce/customer-account';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL(CUSTOMER_PATH, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  try {
    const config = customerConfig(),
      owner = await authorizedPerson('profile.read');
    if (
      !config ||
      !owner ||
      request.nextUrl.origin !== config.origin ||
      request.nextUrl.searchParams.getAll('state').length !== 1
    )
      throw new Error('Invalid callback');
    const raw = (await cookies()).get(FLOW_COOKIE)?.value;
    const state = request.nextUrl.searchParams.get('state');
    validateCustomerFlow(raw, state, owner.person.id, config);
    // An unsolicited or stale callback cannot disconnect a newer valid session.
    // Only matched owner/state consumes the attempt; failures never erase account cookies.
    response.cookies.set(FLOW_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    if (
      request.nextUrl.searchParams.has('error') ||
      request.nextUrl.searchParams.getAll('code').length !== 1
    )
      throw new Error('Provider declined callback');
    const result = await completeCustomerConnection(
      owner.person.id,
      raw,
      state,
      request.nextUrl.searchParams.get('code'),
      config,
    );
    response.cookies.set(ACCOUNT_COOKIE, result.cookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: result.seconds,
    });
    return response;
  } catch {
    response.headers.set(
      'Location',
      new URL(`${CUSTOMER_PATH}?connection=failed`, request.url).toString(),
    );
    return response;
  }
}
