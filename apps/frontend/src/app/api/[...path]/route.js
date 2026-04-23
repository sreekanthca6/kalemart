const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

async function proxy(request, { params }) {
  const segments = (await params).path;
  const path = segments.join('/');
  const search = new URL(request.url).search;
  // Auth routes live at /auth/* on the backend (not under /api)
  const url = segments[0] === 'auth'
    ? `${BACKEND}/${path}${search}`
    : `${BACKEND}/api/${path}${search}`;

  const authHeader = request.headers.get('authorization');
  const init = {
    method: request.method,
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.text();
  }

  const res = await fetch(url, init);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
