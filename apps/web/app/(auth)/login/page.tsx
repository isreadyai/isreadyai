import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { LoginBackdrop } from '@/components/auth/login-backdrop'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login')
  return { title: t('title'), robots: { index: false, follow: false } }
}

/** User login page with OAuth and email sign-in. */
export default function LoginPage() {
  return (
    <main className="bg-site-background relative isolate flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <LoginBackdrop />
      <Link href="/" className="flex items-baseline gap-1 font-semibold tracking-tight">
        <span className="text-site-accent" aria-hidden="true">
          ◆
        </span>
        <span>isready</span>
        <span className="text-site-muted">.ai</span>
      </Link>
      <LoginForm />
    </main>
  )
}
