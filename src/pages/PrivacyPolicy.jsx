import LegalPageLayout from './LegalPageLayout'

const SUMMARY_POINTS = [
  'Covers your account, multi-account balances, income & expense logs, bills, budgets, and savings goals.',
  'Zero bank credentials stored — Buhay never requests, stores, or accesses your bank logins, PINs, or OTPs.',
  'Explains manual tracking, client-side privacy, CSV/JSON backups, and account deletion rights.',
]

const SECTIONS = [
  {
    title: 'What this policy covers',
    paragraphs: [
      'This Privacy Policy explains how Buhay handles information when you visit the website, create an account, and use the web application for personal financial tracking, cashflow forecasting, bills management, and net worth calculations.',
      'It is written to match the product as it exists today: a private, calm personal finance cockpit designed for intentional everyday money management.',
    ],
  },
  {
    title: 'Information Buhay collects',
    paragraphs: ['Depending on how you use the product, Buhay may store the following information under your authenticated account:'],
    bullets: [
      'Account and profile information such as your name, email address, password-based authentication credentials, and email-verification status.',
      'Financial records including manual cash & bank account balances, income logs, expense entries, recurring bills, subscriptions, debt records, envelope budget limits, savings goals, and crypto holdings.',
      'Forecast settings such as manual calendar balance adjustments and recurring transaction schedules.',
      'App preferences including currency symbol, in-app notification preferences, and privacy-mode display toggle.',
      'Feedback or support messages submitted directly through the application.',
    ],
  },
  {
    title: 'Zero bank credentials policy',
    paragraphs: [
      'Buhay does not connect to your bank accounts through screen-scraping, third-party data aggregators, or automated credential storage.',
      'We never ask for, collect, or store your online banking passwords, credit card PINs, SMS OTPs, or API credentials. Your financial institutions remain strictly private and untouched.',
    ],
  },
  {
    title: 'How Buhay uses your information',
    bullets: [
      'To securely authenticate your account, maintain your login session, and enable password recovery or email verification flows.',
      'To provide core financial calculations, including 30-day cashflow forecasts, multi-account net worth aggregation, bill due alerts, and budget pacing.',
      'To sync your saved records seamlessly across your devices signed in to your account.',
      'To display customizable in-app alerts and notifications that you explicitly turn on.',
      'To troubleshoot technical bugs and maintain platform reliability.',
    ],
  },
  {
    title: 'When information is shared',
    paragraphs: ['Buhay does not sell, rent, or monetize your personal data or financial logs with advertisers or data brokers. Information is processed only by essential infrastructure providers:'],
    bullets: [
      'Google Firebase, for encrypted cloud database storage and authentication.',
      'Vercel, for hosting and serving the web application.',
      'Law enforcement or regulatory authorities only when strictly required by applicable law or court order.',
    ],
  },
  {
    title: 'Data retention, export, and deletion',
    bullets: [
      'Your financial records are retained only while your account remains active.',
      'You can download a complete CSV transaction ledger or export an encrypted JSON backup file directly from the Settings page at any time.',
      'You can delete specific transactions, accounts, or reset all financial data with 1-click in Settings.',
      'If you choose to delete your account, all associated records, profile data, and logs are permanently and irreversibly purged from our database.',
    ],
  },
  {
    title: 'Your choices and privacy rights',
    paragraphs: [
      'You have complete control over the data you enter into Buhay.',
      'Under applicable data privacy laws, including the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and international standards, you have rights to access, rectify, port, and erase your personal data.',
    ],
    bullets: [
      'Toggle Privacy Mode at any time to blur financial figures for screen sharing or public use.',
      'Update account details, currency preferences, and notification toggles directly in Settings.',
      'Export your entire data ledger before making major changes or closing your account.',
      'Contact our support team for any privacy inquiries or assistance.',
    ],
  },
  {
    title: 'Security and encryption',
    paragraphs: [
      'All data transmitted to and from Buhay is encrypted in transit using industry-standard TLS/SSL protocols. Stored database records are protected with authenticated Firebase access control rules.',
      'While we implement rigorous security safeguards, no internet-based platform is completely infallible. We encourage users to maintain strong, unique passwords.',
    ],
  },
  {
    title: 'Updates and contact',
    paragraphs: [
      'We may update this Privacy Policy to reflect improvements in our architecture or changes in legal requirements. Material updates will be published on this page with a revised date.',
      'For privacy-related questions or data requests, please contact our support team at support@takda.app.',
    ],
  },
]

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="Privacy Policy"
      title="How Buhay protects your account and personal financial data."
      intro="This page explains what information Buhay stores, why it is used, how zero bank passwords are required, and how you can export or delete your financial data at any time."
      metaTitle="Privacy Policy — Buhay"
      metaDescription="Read how Buhay handles your personal finance data, cashflow logs, privacy mode, and universal CSV/JSON data export."
      metaPath="/privacy"
      summaryPoints={SUMMARY_POINTS}
      sections={SECTIONS}
    />
  )
}
