import { describe, expect, test } from 'bun:test'
import { extractAnchors, extractLinkTags } from './html.ts'

describe('extractAnchors', () => {
  test('reads href and collapsed visible text', () => {
    const anchors = extractAnchors('<a href="/docs">  Read   <b>the</b>\n docs </a>')
    expect(anchors).toEqual([{ href: '/docs', text: 'Read the docs', label: '' }])
  })

  test('tolerates single-quoted, unquoted and uppercase attributes', () => {
    const anchors = extractAnchors(
      `<A HREF='/a'>One</A><a href=/b>Two</a><a class=x href="/c">Three</a>`,
    )
    expect(anchors.map((a) => a.href)).toEqual(['/a', '/b', '/c'])
    expect(anchors.map((a) => a.text)).toEqual(['One', 'Two', 'Three'])
  })

  test('label prefers aria-label, then title, then inner img alt', () => {
    const anchors = extractAnchors(
      `<a href="/1" aria-label="Home" title="T"></a>
       <a href="/2" title="Profile"></a>
       <a href="/3"><img src="x.png" alt="Logo"></a>
       <a href="/4"><svg></svg></a>`,
    )
    expect(anchors.map((a) => a.label)).toEqual(['Home', 'Profile', 'Logo', ''])
  })

  test('skips anchors without href and ignores abbr/address tags', () => {
    const anchors = extractAnchors('<a name="top">x</a><abbr>y</abbr><address>z</address>')
    expect(anchors).toEqual([])
  })
})

describe('extractLinkTags', () => {
  test('reads rel, type and href with any quoting', () => {
    const tags = extractLinkTags(
      `<link rel="alternate" type="application/rss+xml" href="/feed.xml">
       <LINK REL=stylesheet HREF='/a.css' />`,
    )
    expect(tags).toEqual([
      { rel: 'alternate', type: 'application/rss+xml', href: '/feed.xml' },
      { rel: 'stylesheet', type: '', href: '/a.css' },
    ])
  })

  test('returns empty strings for missing attributes', () => {
    expect(extractLinkTags('<link>')).toEqual([{ rel: '', type: '', href: '' }])
  })
})
