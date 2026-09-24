import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

function privateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  return mapped ? privateIpv4(mapped[1]!) : false;
}

export async function assertPublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('UNSAFE_URL');
  const hostname = url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1, -1)
    : url.hostname;
  if (['localhost', '0.0.0.0'].includes(hostname.toLowerCase()) || hostname.endsWith('.local')) throw new Error('UNSAFE_URL');
  if (isIP(hostname)) {
    if (privateAddress(hostname)) throw new Error('UNSAFE_URL');
    return url;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error('UNSAFE_URL');
  return url;
}

export async function checkPublicUrl(value: string, redirects = 3): Promise<{ online: boolean; status: number; latencyMs: number; finalUrl: string }> {
  let current = await assertPublicUrl(value);
  const started = Date.now();
  for (let index = 0; index <= redirects; index += 1) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'DevForge-Uptime-Monitor/2.0' },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      await response.body?.cancel();
      if (index === redirects) throw new Error('TOO_MANY_REDIRECTS');
      current = await assertPublicUrl(new URL(response.headers.get('location')!, current).toString());
      continue;
    }
    await response.body?.cancel();
    return { online: response.status < 500, status: response.status, latencyMs: Date.now() - started, finalUrl: current.toString() };
  }
  throw new Error('MONITOR_FAILED');
}
