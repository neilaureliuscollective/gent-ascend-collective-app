import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
// The Shopify adapter remains reusable; this public runtime no longer sells products.
const retired = () =>
  NextResponse.json(
    { error: 'Retail checkout has moved out of Aethelios.' },
    { status: 410, headers: { 'Cache-Control': 'private, no-store' } },
  );
export async function GET() {
  return retired();
}
export async function POST() {
  return retired();
}
