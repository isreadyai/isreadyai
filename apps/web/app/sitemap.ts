import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// MARK: - sitemap.xml

// Public, indexable pages (dashboard/auth/report routes are noindex/dynamic).
const PATHS = ['', '/pricing', '/privacy', '/terms-and-conditions', '/acknowledgements']

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
