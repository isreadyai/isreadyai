import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Acknowledgements — isready.ai',
  description: 'The open-source libraries and tools that make isready.ai possible.',
  robots: { index: true, follow: true },
}

interface IThanksItem {
  name: string
  url: string
  desc: string
}

const SECTIONS: { title: string; items: IThanksItem[] }[] = [
  {
    title: 'Framework & runtime',
    items: [
      {
        name: 'Next.js',
        url: 'https://nextjs.org/',
        desc: 'The React framework powering the web app',
      },
      { name: 'React', url: 'https://react.dev/', desc: 'UI library' },
      {
        name: 'TypeScript',
        url: 'https://www.typescriptlang.org/',
        desc: 'Typed JavaScript, end to end',
      },
      { name: 'Bun', url: 'https://bun.com/', desc: 'Runtime, package manager and test runner' },
      { name: 'Turborepo', url: 'https://turborepo.com/', desc: 'Monorepo task orchestration' },
    ],
  },
  {
    title: 'UI & design',
    items: [
      { name: 'HeroUI', url: 'https://heroui.com/', desc: 'React component library' },
      { name: 'Tailwind CSS', url: 'https://tailwindcss.com/', desc: 'Utility-first styling' },
      { name: 'Geist', url: 'https://vercel.com/font', desc: "Vercel's sans & mono typeface" },
      { name: 'GSAP', url: 'https://gsap.com/', desc: 'Animation' },
      { name: 'Sonner', url: 'https://sonner.emilkowal.ski/', desc: 'Toast notifications' },
      {
        name: 'Streamdown',
        url: 'https://streamdown.ai/',
        desc: 'Streaming-markdown renderer for AI replies',
      },
    ],
  },
  {
    title: 'AI',
    items: [
      { name: 'Vercel AI SDK', url: 'https://ai-sdk.dev/', desc: 'Chat, streaming and tool calls' },
      {
        name: 'AI Elements',
        url: 'https://elements.ai-sdk.dev/',
        desc: 'Composable AI chat UI primitives',
      },
      {
        name: 'Vercel AI Gateway',
        url: 'https://vercel.com/ai-gateway',
        desc: 'Model routing for the Smart Agent',
      },
      {
        name: 'Vercel Sandbox',
        url: 'https://vercel.com/docs/vercel-sandbox',
        desc: 'Isolated agent-browser runtime',
      },
    ],
  },
  {
    title: 'Data, payments & infrastructure',
    items: [
      { name: 'Supabase', url: 'https://supabase.com/', desc: 'Postgres, auth and storage' },
      { name: 'Stripe', url: 'https://stripe.com/', desc: 'Subscriptions and billing' },
      { name: 'Vercel', url: 'https://vercel.com/', desc: 'Hosting and deploys' },
      { name: 'Resend', url: 'https://resend.com/', desc: 'Transactional email for reports' },
      {
        name: 'Cloudflare Turnstile',
        url: 'https://www.cloudflare.com/products/turnstile/',
        desc: 'Friendly CAPTCHA',
      },
    ],
  },
  {
    title: 'Libraries & utilities',
    items: [
      { name: 'Zod', url: 'https://zod.dev/', desc: 'Schema validation' },
      { name: 'next-intl', url: 'https://next-intl.dev/', desc: 'Internationalization' },
      {
        name: 'next-themes',
        url: 'https://github.com/pacocoursey/next-themes',
        desc: 'Theme handling',
      },
      { name: 'jsPDF', url: 'https://github.com/parallax/jsPDF', desc: 'PDF report export' },
      {
        name: '@clack/prompts',
        url: 'https://www.clack.cc/',
        desc: "The CLI's interactive prompts",
      },
    ],
  },
  {
    title: 'Tooling',
    items: [
      {
        name: 'oxlint & oxfmt',
        url: 'https://oxc.rs/',
        desc: 'Fast Rust-based linting and formatting',
      },
      {
        name: 'Stripe CLI',
        url: 'https://docs.stripe.com/stripe-cli',
        desc: 'Local webhook forwarding',
      },
      {
        name: 'dotenv-cli · exits',
        url: 'https://github.com/rafamel/exits',
        desc: 'Dev orchestration',
      },
    ],
  },
]

export default function AcknowledgementsPage() {
  return (
    <main className="site-container max-w-5xl pt-32 pb-24">
      <p className="text-site-accent font-mono text-sm">Thank you</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Acknowledgements</h1>
      <p className="text-site-muted mt-4 max-w-2xl leading-relaxed">
        isready.ai stands on the shoulders of a lot of brilliant open-source work and generous free
        tiers. A heartfelt thank you to everyone who builds and maintains these — we couldn&apos;t
        have shipped this without you. 💚
      </p>

      <div className="mt-12 space-y-12">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-site-muted mb-4 text-xs font-medium tracking-wide uppercase">
              {section.title}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-site-border bg-site-surface/50 hover:border-site-accent-dim block h-full rounded-2xl border p-4 transition-colors"
                  >
                    <p className="text-site-text font-medium">{item.name}</p>
                    <p className="text-site-muted mt-1 text-sm leading-relaxed">{item.desc}</p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-site-faint mt-14 text-sm">
        Built with care by{' '}
        <a
          href="https://smartsquad.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-site-accent hover:underline"
        >
          Smart Squad
        </a>
        .
      </p>
    </main>
  )
}
