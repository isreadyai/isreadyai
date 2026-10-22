import { describe, expect, test } from 'bun:test'
import { GITHUB_URL, SITE_URL } from '@/lib/site'
import { organizationNode, websiteNode } from './json-ld'

describe('organizationNode', () => {
  test('keeps the homepage Organization shape', () => {
    expect(organizationNode()).toEqual({
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'isready.ai',
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: [GITHUB_URL],
    })
  })
})

describe('websiteNode', () => {
  test('references the Organization as publisher', () => {
    const node = websiteNode()
    expect(node['@type']).toBe('WebSite')
    expect(node['@id']).toBe(`${SITE_URL}/#website`)
    expect(node.publisher).toEqual({ '@id': organizationNode()['@id'] })
  })
})
