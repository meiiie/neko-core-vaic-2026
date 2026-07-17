const ORIGIN = 'https://nekopath-origin.34-142-197-144.sslip.io';

function originUrl(requestUrl: string): URL {
  const incoming = new URL(requestUrl);
  return new URL(`${incoming.pathname}${incoming.search}`, ORIGIN);
}

/**
 * Thin Cloudflare edge in front of the GCP VPS.
 *
 * Authentication, authorization, data and product behavior stay on the VPS;
 * this Worker only preserves the HTTP request/response contract while giving
 * the canonical hostname Cloudflare-managed DNS and TLS.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const method = request.method.toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
    const upstreamRequest = new Request(originUrl(request.url), {
      method,
      headers: request.headers,
      body,
      redirect: 'manual',
    });
    upstreamRequest.headers.set('X-Forwarded-Host', incoming.host);
    upstreamRequest.headers.set('X-Forwarded-Proto', 'https');

    const upstreamResponse = await fetch(upstreamRequest, { redirect: 'manual' });
    const headers = new Headers(upstreamResponse.headers);
    const location = headers.get('Location');

    if (location?.startsWith(ORIGIN)) {
      headers.set('Location', `${incoming.origin}${location.slice(ORIGIN.length)}`);
    }

    const cacheControl = headers.get('Cache-Control');
    if (
      headers.get('Content-Type')?.toLowerCase().includes('text/html') &&
      !cacheControl?.toLowerCase().includes('no-transform')
    ) {
      headers.set('Cache-Control', [cacheControl, 'no-transform'].filter(Boolean).join(', '));
    }
    headers.set('X-NekoPath-Edge', 'cloudflare');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};

export { ORIGIN, originUrl };
