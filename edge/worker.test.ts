import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { ORIGIN, originUrl } from './worker';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NekoPath Cloudflare edge', () => {
  it('maps the canonical path and query to the HTTPS VPS origin', () => {
    expect(originUrl('https://nekopath.holilihu.online/api/healthz?probe=1').toString()).toBe(
      `${ORIGIN}/api/healthz?probe=1`,
    );
  });

  it('preserves method, body and forwarding context', async () => {
    const upstream = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(upstream);

    const response = await worker.fetch(
      new Request('https://nekopath.holilihu.online/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"username":"co.ha"}',
      }),
    );

    const forwarded = upstream.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`${ORIGIN}/api/auth/login`);
    expect(forwarded.method).toBe('POST');
    expect(await forwarded.text()).toBe('{"username":"co.ha"}');
    expect(forwarded.headers.get('X-Forwarded-Host')).toBe('nekopath.holilihu.online');
    expect(response.headers.get('X-NekoPath-Edge')).toBe('cloudflare');
    expect(response.headers.get('Cache-Control')).toBeNull();
  });

  it('prevents automatic third-party injection into HTML without weakening the CSP', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      vi.fn(
        async () =>
          new Response('<!doctype html><title>NekoPath</title>', {
            headers: {
              'Cache-Control': 'no-cache',
              'Content-Type': 'text/html; charset=utf-8',
            },
          }),
      ),
    );

    const response = await worker.fetch(new Request('https://nekopath.holilihu.online/'));

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
  });

  it('rewrites an origin redirect back to the canonical hostname', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      vi.fn(async () => Response.redirect(`${ORIGIN}/login?next=%2Fteacher`, 307)),
    );

    const response = await worker.fetch(new Request('https://nekopath.holilihu.online/start'));

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe(
      'https://nekopath.holilihu.online/login?next=%2Fteacher',
    );
  });
});
