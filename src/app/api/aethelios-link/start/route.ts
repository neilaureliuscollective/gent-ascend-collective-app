// Private founder history is not company knowledge for the public platform.
export async function GET() {
  return new Response('Private founder linking is unavailable in this platform.', {
    status: 410,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
