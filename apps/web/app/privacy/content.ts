import type { LegalContent } from '@/components/legal-page'

// MARK: - Privacy Policy content (English-only; intentionally not in i18n/messages)
// MARK: contact / data-protection inbox is isreadyai@smartsquad.io.

export const privacyContent: LegalContent = {
  title: 'Privacy Policy',
  updated: '17 June 2026',
  intro: [
    'This Privacy Policy explains how isready.ai ("isready.ai", "we", "us") collects, uses, and protects personal data when you use our website, dashboard, API, CLI, and related services (together, the "Service").',
    'isready.ai is operated by Smart Squad S.r.l., the same company behind Inksquad. We are committed to handling your data lawfully, transparently, and in line with the EU General Data Protection Regulation (GDPR).',
  ],
  sections: [
    {
      heading: '1. Data Controller',
      paragraphs: [
        {
          text: 'The data controller responsible for your personal data is Smart Squad S.r.l. ("Smart Squad"), an Italian limited liability company. You can learn more about the company at {Smart Squad}.',
          links: [{ label: 'Smart Squad', href: 'https://smartsquad.io' }],
        },
        'Registered office: Via Savorgnana 1, 33100 Udine (UD), Italy. Partita IVA / Codice Fiscale: 02898170309. REA: UD-296388. Incorporated on 17 July 2017.',
        'For any privacy-related or formal legal request, you can reach us at isreadyai@smartsquad.io.',
      ],
    },
    {
      heading: '2. Data We Collect',
      paragraphs: [
        'We collect only the data we need to provide and secure the Service. Depending on how you use isready.ai, this may include:',
      ],
      bullets: [
        'Account data — the email address you sign up with, your user ID, an optional display name, and any GitHub or Google account you choose to connect for sign-in.',
        'Scan data — the URLs you submit for scanning and the resulting AI-readiness reports, deep-scan results, Smart Agent reports, and scores. Scans run anonymously are not linked to an account.',
        'Workspace and team data — workspace names, member email addresses, roles, invitations, verified domains, and monitoring schedules.',
        'Chat data — when you use "Ask your site", the messages you send and the AI responses are stored as conversation threads, together with the scan they are grounded on.',
        'Usage metering — counts of AI messages, generations, and tokens consumed per billing period, used to enforce plan quotas and fair-use limits.',
        'Billing data — when you subscribe to a paid plan, your Stripe customer and subscription identifiers, subscription status, billing period, and limited payment-method details (card brand and last four digits). We do not store full card numbers; payment details are handled by Stripe.',
        'API key data — a prefix and a hash of any API keys you generate (we never store the full key), their scopes, expiry, and last-used time.',
        'Technical data — for abuse prevention and rate-limiting we store a salted SHA-256 hash of your IP address rather than the raw IP, along with basic request metadata.',
      ],
    },
    {
      heading: '3. How and Why We Use Your Data',
      paragraphs: ['We use your personal data for the following purposes:'],
      bullets: [
        'To provide the Service — running scans, generating reports, powering the Smart Agent and "Ask your site" chat, monitoring domains, and issuing README badges.',
        'To manage your account, workspaces, team members, and invitations.',
        'To process subscriptions, payments, renewals, and cancellations through Stripe.',
        'To enforce plan entitlements, quotas, and fair-use limits.',
        'To send transactional emails such as scan reports, monitoring alerts, and team invitations.',
        'To secure the Service, prevent abuse, and protect against fraud, scanning of unauthorized targets, and server-side request forgery (SSRF).',
        'To comply with our legal obligations.',
      ],
    },
    {
      heading: '4. Legal Bases for Processing (GDPR)',
      paragraphs: ['Where GDPR applies, we rely on the following legal bases:'],
      bullets: [
        'Performance of a contract (Art. 6(1)(b)) — to deliver the Service you have requested and signed up for, including running scans, chat, and billing.',
        'Legitimate interests (Art. 6(1)(f)) — to secure the Service, prevent abuse, meter usage, and improve reliability, balanced against your rights and freedoms.',
        'Legal obligation (Art. 6(1)(c)) — to retain billing records and comply with applicable law.',
        'Consent (Art. 6(1)(a)) — where we ask for it, for example for optional communications; you can withdraw consent at any time.',
      ],
    },
    {
      heading: '5. Service Providers and Processors',
      paragraphs: [
        'We share personal data with carefully selected providers who process it on our behalf, under appropriate data processing agreements. Our main processors and partners are:',
      ],
      bullets: [
        {
          text: '{Supabase} — database, authentication, and storage for accounts, scans, workspaces, chat threads, and usage records (see Supabase’s {Data Processing Addendum}).',
          links: [
            { label: 'Supabase', href: 'https://supabase.com' },
            { label: 'Data Processing Addendum', href: 'https://supabase.com/legal/dpa' },
          ],
        },
        {
          text: '{Stripe} — payment processing and subscription management (see {Stripe’s privacy policy}).',
          links: [
            { label: 'Stripe', href: 'https://stripe.com' },
            { label: 'Stripe’s privacy policy', href: 'https://stripe.com/privacy' },
          ],
        },
        {
          text: '{Resend} — delivery of transactional emails such as scan reports, alerts, and team invitations.',
          links: [{ label: 'Resend', href: 'https://resend.com' }],
        },
        {
          text: '{Vercel} — hosting, serverless compute, isolated sandbox rendering for Smart Agent scans, and the Vercel AI Gateway used to route requests to AI model providers.',
          links: [{ label: 'Vercel', href: 'https://vercel.com' }],
        },
        {
          text: '{Cloudflare} — Turnstile CAPTCHA and bot protection during sign-up and certain actions.',
          links: [{ label: 'Cloudflare', href: 'https://www.cloudflare.com' }],
        },
        {
          text: '{GitHub} — OAuth sign-in and the isready.ai GitHub Action.',
          links: [{ label: 'GitHub', href: 'https://github.com' }],
        },
      ],
    },
    {
      heading: '6. AI Model Providers',
      paragraphs: [
        'The Smart Agent and "Ask your site" chat are powered by large language models. By default, your messages and the relevant scan context are sent through the Vercel AI Gateway to a model provider we have selected to generate responses. Depending on configuration, the underlying provider may be one of:',
      ],
      bullets: [
        {
          text: '{Anthropic} (Claude)',
          links: [{ label: 'Anthropic', href: 'https://www.anthropic.com' }],
        },
        {
          text: '{OpenAI} (ChatGPT)',
          links: [{ label: 'OpenAI', href: 'https://openai.com' }],
        },
        {
          text: '{Google} (Gemini)',
          links: [{ label: 'Google', href: 'https://ai.google.dev' }],
        },
        {
          text: '{xAI} (Grok)',
          links: [{ label: 'xAI', href: 'https://x.ai' }],
        },
      ],
    },
    {
      heading: '7. Bring-Your-Own AI Key (BYO)',
      paragraphs: [
        'If you choose to bring your own AI provider key (BYO), your prompts and the related scan context are sent directly to the AI provider you select, using your own credentials and under that provider’s own terms and privacy policy. In that case we do not route those prompts through our default model provider, and the provider you choose acts as an independent controller or processor for that data. You are responsible for your use of, and compliance with, your chosen provider’s terms.',
      ],
    },
    {
      heading: '8. International Transfers',
      paragraphs: [
        'Some of our providers may process data outside the European Economic Area (EEA). Where this happens, we rely on appropriate safeguards such as the European Commission’s Standard Contractual Clauses, or transfers to countries recognized as providing an adequate level of protection.',
      ],
    },
    {
      heading: '9. Data Retention',
      paragraphs: [
        'We keep personal data only for as long as necessary for the purposes described in this policy.',
      ],
      bullets: [
        'Account, workspace, and domain data are kept for as long as your account is active.',
        'Scan reports and score history are retained according to your plan (for example, a shorter history window on the Free plan and longer windows on paid plans), or until you delete them.',
        'Chat threads are retained until you delete them or close your account.',
        'IP-address hashes used for rate-limiting are short-lived and used only for abuse prevention.',
        'Billing records are retained as required by applicable tax and accounting law.',
        'When you close your account, we delete or anonymize your personal data within a reasonable period, except where we are legally required to retain it.',
      ],
    },
    {
      heading: '10. Your Rights',
      paragraphs: [
        'Subject to applicable law, you have the right to access, rectify, erase, restrict, or object to the processing of your personal data, and the right to data portability. You may also withdraw consent where processing is based on consent.',
        'To exercise any of these rights, contact us at isreadyai@smartsquad.io. You also have the right to lodge a complaint with your local data protection authority; in Italy this is the Garante per la protezione dei dati personali.',
      ],
    },
    {
      heading: '11. Cookies and Essential Storage',
      paragraphs: [
        'isready.ai uses only the cookies and local storage strictly necessary to operate the Service — primarily to keep you signed in and to maintain your session and preferences. We do not use advertising cookies or sell your data. If we introduce any non-essential or analytics cookies in the future, we will ask for your consent where required.',
      ],
    },
    {
      heading: '12. Security',
      paragraphs: [
        'We apply technical and organizational measures to protect your data, including encryption in transit, hashing of API keys and IP addresses, access controls, and reliance on reputable infrastructure providers. No method of transmission or storage is completely secure, but we work to protect your data using industry-standard practices.',
      ],
    },
    {
      heading: '13. Children',
      paragraphs: [
        'The Service is not directed to children. It is intended for use by professionals and organizations, and you must be at least 16 years old (or the minimum age required in your country) to use it. We do not knowingly collect personal data from children.',
      ],
    },
    {
      heading: '14. Changes to This Policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date above and, where appropriate, notify you. Your continued use of the Service after changes take effect constitutes acceptance of the updated policy.',
      ],
    },
    {
      heading: '15. Contact',
      paragraphs: [
        {
          text: 'If you have any questions about this Privacy Policy or how we handle your data, contact Smart Squad S.r.l. at isreadyai@smartsquad.io, or visit {smartsquad.io}.',
          links: [{ label: 'smartsquad.io', href: 'https://smartsquad.io' }],
        },
      ],
    },
  ],
}
