import type { MetadataRoute } from 'next'
import { AI_CRAWLERS } from '@isreadyai/scanner'
import { SITE_URL } from '@/lib/site'

// MARK: - robots.txt (dogfood: every AI crawler explicitly welcome)

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
      ...AI_CRAWLERS.map((crawler) => ({
        userAgent: crawler.token,
        allow: '/',
        disallow: ['/api/'],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
