import { describe, expect, it } from 'vitest';
import { assertPublicUrl } from '../src/v2/network.js';

describe('uptime monitor URL safety', () => {
  it.each([
    'http://127.0.0.1/admin',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://192.168.1.20/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'file:///etc/passwd',
    'https://user:password@8.8.8.8/',
  ])('rejects unsafe target %s', async (value) => {
    await expect(assertPublicUrl(value)).rejects.toThrow('UNSAFE_URL');
  });

  it('accepts a public HTTPS IP without a DNS lookup', async () => {
    await expect(assertPublicUrl('https://8.8.8.8/status')).resolves.toMatchObject({
      protocol: 'https:',
      hostname: '8.8.8.8',
      pathname: '/status',
    });
  });
});
