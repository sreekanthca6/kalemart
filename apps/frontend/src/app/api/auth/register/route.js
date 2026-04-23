const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

export async function POST(request) {
  const body = await request.text();
  const res = await fetch(`${BACKEND}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } });
}
