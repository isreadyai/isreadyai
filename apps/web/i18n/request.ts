import { getRequestConfig } from 'next-intl/server'

// Single-locale for now; strings stay in the messages layer so adding locales
// won't touch components.
export const DEFAULT_LOCALE = 'en'

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
