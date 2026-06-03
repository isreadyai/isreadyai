import type { LegalContent } from '@/components/legal-page'

// MARK: - Terms and Conditions content (English-only; intentionally not in i18n/messages)
// MARK: contact / legal inbox is isreadyai@smartsquad.io.

export const termsContent: LegalContent = {
  title: 'Terms and Conditions',
  updated: '17 June 2026',
  intro: [
    'These Terms and Conditions ("Terms") govern your access to and use of isready.ai (the "Service"), operated by Smart Squad S.r.l. ("Smart Squad", "we", "us"), the company behind Inksquad. Please read them carefully.',
    'Smart Squad S.r.l. is an Italian limited liability company with registered office at Via Savorgnana 1, 33100 Udine (UD), Italy, Partita IVA / Codice Fiscale 02898170309, REA UD-296388.',
  ],
  sections: [
    {
      heading: '1. Acceptance of Terms',
      paragraphs: [
        'By creating an account, accessing, or using the Service, you agree to be bound by these Terms and by our Privacy Policy. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization, and "you" refers to both you and that organization. If you do not agree, you must not use the Service.',
      ],
    },
    {
      heading: '2. Description of the Service',
      paragraphs: [
        'isready.ai helps you measure and improve how well your website is understood by AI agents and crawlers. The Service includes, depending on your plan:',
      ],
      bullets: [
        'AI-readiness scanning — an audit that produces a 0–100 score across crawler access, rendering, structured data, content signals, and trust/security.',
        'Reports — human-readable Markdown, machine-readable JSON, and AI-agent fix plans, available for download and by email.',
        'Deep Scan — crawling of your sitemap and internal links to produce a site-wide score and per-page findings.',
        'Smart Agent — a browser-rendering audit measuring what browser-capable AI agents can see, including an accessibility-tree view.',
        '"Ask your site" chat — a grounded chat interface over your scan reports.',
        'Monitoring and alerts — scheduled re-scans with score-drop notifications.',
        'README badges — a signed, live SVG badge reflecting a verified domain’s current score.',
        'CLI and GitHub Action — command-line scanning and CI/CD gating of deploys based on AI-readiness scores.',
      ],
    },
    {
      heading: '3. Accounts and Eligibility',
      paragraphs: [
        'To use most features you must create an account. You agree to provide accurate information, keep your credentials secure, and remain responsible for all activity under your account. You must be at least 16 years old (or the minimum age required in your country) and capable of entering into a binding contract. Notify us promptly of any unauthorized use of your account.',
      ],
    },
    {
      heading: '4. Acceptable Use',
      paragraphs: ['You agree not to use the Service to:'],
      bullets: [
        'Scan, crawl, or monitor any website or property that you do not own or are not authorized to test. You are solely responsible for ensuring you have permission to scan a target.',
        'Attempt to access internal, private, or restricted networks, or use the Service to perform server-side request forgery (SSRF) or to probe infrastructure you are not authorized to test.',
        'Overload, disrupt, or abuse the Service or third-party sites, including by circumventing rate limits, quotas, or security controls.',
        'Reverse engineer, resell, or misuse the Service or its API beyond the scope of your plan and these Terms.',
        'Upload or transmit unlawful, infringing, or malicious content, or use the Service in violation of any applicable law.',
      ],
      // MARK: SSRF / authorization clauses are load-bearing — keep aligned with the app's scan safeguards
    },
    {
      heading: '5. Plans, Billing, and Refunds',
      paragraphs: [
        'The Service offers a Free plan and paid Pro and Team plans, each with different features and usage limits.',
      ],
      bullets: [
        {
          text: 'Paid plans are billed in advance on a recurring basis (for example monthly or annually) through our payment processor, {Stripe}. By subscribing, you authorize us to charge your payment method for the applicable fees and taxes.',
          links: [{ label: 'Stripe', href: 'https://stripe.com' }],
        },
        'Subscriptions renew automatically at the end of each billing period unless cancelled before renewal.',
        'You can cancel at any time from your account; cancellation takes effect at the end of the current billing period, and you retain access until then.',
        'Except where required by law, fees already paid are non-refundable, and we do not provide refunds or credits for partial periods or unused features.',
        'We may change plan pricing or features; we will give reasonable notice of material changes, which take effect on your next renewal.',
      ],
    },
    {
      heading: '6. API Keys, Quotas, and Fair Use',
      paragraphs: [
        'Paid plans include API access and AI-powered features subject to quotas and fair-use limits (for example, monthly chat-message allowances, scan volumes, domain and member limits, and fix-run quotas). You are responsible for keeping your API keys confidential and for all usage made with them. We may throttle, suspend, or limit access where usage exceeds your plan’s entitlements or where we reasonably suspect abuse.',
      ],
    },
    {
      heading: '7. Intellectual Property',
      paragraphs: [
        'The Service, including its software, branding, and content (excluding your data and the websites you scan), is owned by Smart Squad or its licensors and is protected by intellectual property laws. Portions of isready.ai are released under open-source and source-available licenses as indicated in the project repository and in the "Third-party software and licenses" section below; those components are governed by their respective licenses. We grant you a limited, non-exclusive, non-transferable right to use the Service in accordance with these Terms.',
        'We reserve the right, at our sole discretion and to the extent permitted by applicable law, to change the licensing terms under which we make future versions of isready.ai’s own software available — including how its open-source and source-available components are licensed. Any such change applies prospectively only: versions already released remain governed by the license in effect when they were released and are not retroactively revoked. This does not affect the third-party components listed below, which are governed solely by their respective authors’ licenses.',
        'You retain ownership of the data you submit and the reports generated for you, and you grant us the rights necessary to operate and provide the Service to you.',
      ],
    },
    {
      heading: '8. Third-Party Sites and Content',
      paragraphs: [
        'The Service analyzes third-party websites that you choose to scan and may surface content from them. We do not control and are not responsible for those sites, their content, or their availability. Scan results, scores, and AI-generated suggestions are provided for informational purposes and may be incomplete or inaccurate; you are responsible for evaluating them before acting.',
      ],
    },
    {
      heading: '9. Third-Party Services and Partners',
      paragraphs: [
        'The Service relies on third-party providers, each governed by its own terms and data processing agreements. The main ones are:',
      ],
      bullets: [
        {
          text: '{Supabase} — database, authentication, and storage.',
          links: [{ label: 'Supabase', href: 'https://supabase.com' }],
        },
        {
          text: '{Stripe} — payments and subscription billing.',
          links: [{ label: 'Stripe', href: 'https://stripe.com' }],
        },
        {
          text: '{Resend} — transactional email (reports, alerts, team invites).',
          links: [{ label: 'Resend', href: 'https://resend.com' }],
        },
        {
          text: '{Vercel} — hosting and the Vercel AI Gateway for LLM routing.',
          links: [{ label: 'Vercel', href: 'https://vercel.com' }],
        },
        {
          text: '{Cloudflare} — Turnstile CAPTCHA and bot protection.',
          links: [{ label: 'Cloudflare', href: 'https://www.cloudflare.com' }],
        },
        {
          text: '{Anthropic} (Claude), {OpenAI} (ChatGPT), {Google} (Gemini), and {xAI} (Grok) — AI model providers for the Smart Agent and "Ask your site" chat.',
          links: [
            { label: 'Anthropic', href: 'https://www.anthropic.com' },
            { label: 'OpenAI', href: 'https://openai.com' },
            { label: 'Google', href: 'https://ai.google.dev' },
            { label: 'xAI', href: 'https://x.ai' },
          ],
        },
        {
          text: '{GitHub} — OAuth sign-in and the isready.ai GitHub Action.',
          links: [{ label: 'GitHub', href: 'https://github.com' }],
        },
      ],
    },
    {
      heading: '10. Third-Party Software and Licenses',
      paragraphs: [
        'isready.ai is built on open-source software. The following components are used under their respective licenses; their copyright notices and license terms belong to their authors. This list is provided for transparency and may change as dependencies are updated.',
      ],
      bullets: [
        'next 16.2.9 — MIT',
        'react 19.2.7 and react-dom 19.2.7 — MIT',
        'next-intl 4.13.0 — MIT',
        'next-themes 0.4.6 — MIT',
        'ai (Vercel AI SDK) 6.0.205 — Apache-2.0',
        '@ai-sdk/react 3.0.207 and the @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google, @ai-sdk/xai providers (3.0.x) — Apache-2.0',
        '@supabase/supabase-js 2.108.1 — MIT',
        '@supabase/ssr 0.12.0 — MIT',
        '@supabase/stripe-sync-engine 0.48.5 — Apache-2.0',
        'stripe (Node SDK) 17.7.0 — MIT',
        'zod 4.4.3 — MIT',
        '@heroui/react 3.1.0 — MIT',
        'jspdf 4.2.1 — MIT',
        'sonner 2.0.7 — MIT',
        'streamdown 2.5.0 — Apache-2.0',
        'use-stick-to-bottom 1.1.6 — MIT',
        '@vercel/sandbox 2.2.1 — Apache-2.0',
        'tailwindcss 4.3.1 — MIT',
        'Tooling: turbo (MIT), oxlint (MIT), oxfmt (MIT), TypeScript (Apache-2.0), and the Bun runtime (MIT).',
      ],
    },
    {
      heading: '11. Fonts',
      bullets: ['Geist and Geist Mono 1.7.2 — SIL Open Font License 1.1.'],
    },
    {
      heading: '12. GSAP (GreenSock) License Notice',
      paragraphs: [
        {
          text: 'isready.ai uses GSAP (GreenSock) 3.15.0 for animation. Unlike the libraries listed above, GSAP is not MIT-licensed: it is distributed under the GreenSock Standard "No Charge" License, which is proprietary. It is free for the standard use cases it permits, but certain commercial or "special" uses (such as selling a product where end users are charged a fee specifically for features built with GSAP) require a paid Business Green / "Special" license. If you fork, redistribute, or build on isready.ai, you are responsible for ensuring your use of GSAP complies with its license terms. See the {GreenSock Standard License}.',
          links: [
            { label: 'GreenSock Standard License', href: 'https://gsap.com/standard-license' },
          ],
        },
      ],
    },
    {
      heading: '13. Disclaimer of Warranties',
      paragraphs: [
        'The Service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that scores and recommendations will produce any particular outcome.',
      ],
    },
    {
      heading: '14. Limitation of Liability',
      paragraphs: [
        'To the maximum extent permitted by law, Smart Squad will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill, arising out of or related to your use of the Service. Our total aggregate liability for any claim relating to the Service will not exceed the amount you paid to us for the Service in the twelve months preceding the event giving rise to the claim. Nothing in these Terms limits liability that cannot be limited under applicable law.',
      ],
    },
    {
      heading: '15. Indemnification',
      paragraphs: [
        'You agree to indemnify and hold harmless Smart Squad and its affiliates from any claims, damages, liabilities, and expenses arising out of your use of the Service, your content, or your breach of these Terms — including, in particular, claims arising from scanning targets you were not authorized to scan.',
      ],
    },
    {
      heading: '16. Suspension and Termination',
      paragraphs: [
        'We may suspend or terminate your access to the Service if you breach these Terms, misuse the Service, or where required by law. You may stop using the Service and close your account at any time. Upon termination, your right to use the Service ends, and we may delete your data in accordance with our Privacy Policy, except where retention is legally required.',
      ],
    },
    {
      heading: '17. Governing Law and Jurisdiction',
      paragraphs: [
        'These Terms are governed by the laws of Italy, without regard to conflict-of-law rules. Any dispute arising out of or relating to the Service or these Terms will be subject to the exclusive jurisdiction of the courts of Udine, Italy, except where mandatory consumer-protection law grants you the right to bring proceedings in your place of residence.',
      ],
    },
    {
      heading: '18. Changes to These Terms',
      paragraphs: [
        'We may update these Terms from time to time. When we make material changes, we will update the "Last updated" date above and, where appropriate, notify you. Your continued use of the Service after the changes take effect constitutes acceptance of the updated Terms.',
      ],
    },
    {
      heading: '19. Contact',
      paragraphs: [
        {
          text: 'If you have any questions about these Terms, contact Smart Squad S.r.l. at isreadyai@smartsquad.io, or visit {smartsquad.io}.',
          links: [{ label: 'smartsquad.io', href: 'https://smartsquad.io' }],
        },
      ],
    },
  ],
}
