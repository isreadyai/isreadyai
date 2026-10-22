import { GITHUB_URL, SITE_NAME, SITE_URL } from '@/lib/site'

// MARK: - Shared JSON-LD nodes

/** The Organization node every page references through its `@id`. */
export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#org`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    sameAs: [GITHUB_URL],
  }
}

/** The WebSite node; `dateModified` is the time of the call. */
export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#org` },
    datePublished: '2026-06-15',
    dateModified: new Date().toISOString(),
  }
}
