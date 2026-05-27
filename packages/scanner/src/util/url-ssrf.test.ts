import { describe, expect, test } from 'bun:test'
import { isPrivateAddress, firstPrivateHost } from './url.ts'

// MARK: - IP-range classifier

describe('isPrivateAddress — private/reserved IPv4', () => {
  test.each([
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1', // CGNAT
    '100.127.255.255',
    '127.0.0.1',
    '127.1.2.3',
    '169.254.169.254', // cloud metadata
    '169.254.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.1', // TEST-NET-1
    '192.168.0.1',
    '192.168.1.1',
    '198.18.0.1', // benchmarking
    '198.51.100.1', // TEST-NET-2
    '203.0.113.1', // TEST-NET-3
    '224.0.0.1', // multicast
    '240.0.0.1', // reserved
    '255.255.255.255', // broadcast
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })
})

describe('isPrivateAddress — public IPv4', () => {
  test.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34', // example.com
    '100.63.255.255', // just below CGNAT
    '100.128.0.0', // just above CGNAT
    '172.15.255.255', // just below 172.16/12
    '172.32.0.0', // just above 172.16/12
    '169.253.255.255', // just below link-local
    '11.0.0.0',
    '126.255.255.255',
    '128.0.0.1',
    '223.255.255.255', // just below multicast
  ])('allows %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe('isPrivateAddress — private/reserved IPv6', () => {
  test.each([
    '::1', // loopback
    '::', // unspecified
    'fc00::1', // ULA
    'fd12:3456:789a::1', // ULA
    'fe80::1', // link-local
    'febf:ffff::1', // link-local upper bound
    'ff02::1', // multicast
    '::ffff:10.0.0.1', // IPv4-mapped private
    '::ffff:169.254.169.254', // IPv4-mapped metadata
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    'fe80::1%eth0', // with zone id
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })
})

describe('isPrivateAddress — public IPv6', () => {
  test.each([
    '2606:4700:4700::1111', // Cloudflare
    '2001:4860:4860::8888', // Google
    '2620:0:2d0:200::7',
    '::ffff:8.8.8.8', // IPv4-mapped public
  ])('allows %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe('isPrivateAddress — malformed input fails closed', () => {
  test.each(['', 'not-an-ip', '999.999.999.999', '10.0.0', 'gggg::1', '1.2.3.4.5'])(
    'blocks %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(true)
    },
  )
})

// MARK: - redirect-hop guard

const PUBLIC = ['93.184.216.34']
const resolver = (table: Record<string, string[]>) => async (host: string) => {
  const addrs = table[host]
  if (addrs === undefined) {
    throw new Error(`no record for ${host}`)
  }
  return addrs
}

describe('firstPrivateHost', () => {
  test('returns null when every host is public', async () => {
    const resolve = resolver({ 'a.example.com': PUBLIC, 'b.example.com': PUBLIC })
    expect(await firstPrivateHost(['a.example.com', 'b.example.com'], resolve)).toBeNull()
  })

  test('rejects a redirect hop that resolves to a private IP', async () => {
    const resolve = resolver({
      'public.example.com': PUBLIC,
      'evil.example.com': ['169.254.169.254'], // redirect target → metadata
    })
    const result = await firstPrivateHost(['public.example.com', 'evil.example.com'], resolve)
    expect(result).toBe('evil.example.com')
  })

  test('rejects when any resolved address is private (mixed answer)', async () => {
    const resolve = resolver({ 'rebind.example.com': ['93.184.216.34', '10.0.0.5'] })
    expect(await firstPrivateHost(['rebind.example.com'], resolve)).toBe('rebind.example.com')
  })

  test('fails closed when resolution throws', async () => {
    const resolve = resolver({})
    expect(await firstPrivateHost(['unknown.example.com'], resolve)).toBe('unknown.example.com')
  })

  test('fails closed on an empty DNS answer', async () => {
    const resolve = resolver({ 'empty.example.com': [] })
    expect(await firstPrivateHost(['empty.example.com'], resolve)).toBe('empty.example.com')
  })
})
