import LegalPageLayout from './LegalPageLayout'

const SUMMARY_POINTS = [
  'Covers account, money, fitness, reflection, settings, and any optional media attachments.',
  'Explains manual data entry, exports, deletion, and privacy requests.',
  'Shows which providers help run Buhay and how your data is protected, handled, and removed.',
]

const SECTIONS = [
  {
    title: 'What this policy covers',
    paragraphs: [
      'This Privacy Policy explains how Buhay handles information when you visit the website, create an account, and use the app for money, fitness, reflection, and planning.',
      'It is written to match the product as it exists today: a life tracker built with Filipino clarity and warmth, designed for everyday use anywhere.',
    ],
  },
  {
    title: 'Information Buhay collects',
    paragraphs: ['Depending on how you use the product, Buhay may collect:'],
    bullets: [
      'Account and profile information such as your name, email address, password-based authentication details, and email-verification status.',
      'Financial data such as accounts, balances, transactions, recurring settings, bills, budgets, savings goals, and manual calendar balance overrides.',
      'Fitness and activity data such as workouts, routines, exercises, sets, reps, weight, duration, meals, body logs, habits, activity, reminders, and fitness goals.',
      'Reflection and everyday-life data such as daily check-ins, journal entries, mood logs, tasks, life goals, tags, triggers, notes, and calendar dates.',
      'App configuration such as your currency, notification preferences, privacy-mode preference, and other product settings tied to your account.',
      'Support or feedback information if you contact Buhay directly.',
    ],
  },
  {
    title: 'Image uploads and media attachments',
    paragraphs: [
      'If you choose to upload images to Buhay (such as fitness progress photos or meal logs), those files and their associated metadata are stored securely and remain linked to your tracking records.',
      'Buhay does not require any image uploads for financial tracking or reflection features.',
    ],
    bullets: [
      'Fitness images (meals and body progress) are entirely optional and can be deleted by you at any time.',
      'Uploaded files are stored on secure third-party storage infrastructure and are only accessible through your account.',
    ],
  },
  {
    title: 'How Buhay uses information',
    bullets: [
      'To create and secure your account, keep you signed in, and support password reset or email-verification flows.',
      'To run the app itself, including money, fitness, reflection, calendar, history, and settings views.',
      'To sync your data across supported devices connected to your account.',
      'To display in-app notifications and alerts that you explicitly enable.',
      'To troubleshoot issues, maintain service reliability, and respond to support requests.',
    ],
  },
  {
    title: 'When information is shared',
    paragraphs: ['Buhay does not sell your personal data. Information may still be processed by service providers that help run the product.'],
    bullets: [
      'Firebase, for authentication and app data storage.',
      'Vercel or similar hosting infrastructure used to serve the site or app.',
      'Law enforcement, regulators, or professional advisers when disclosure is required by law, needed for safety, or necessary to protect the service.',
    ],
  },
  {
    title: 'Retention, export, and deletion',
    bullets: [
      'Buhay keeps account data while your account remains active or as long as needed to provide the product and handle support, security, or legal obligations.',
      'The app includes export and backup features so you can keep your own copy of your data.',
      'If you delete data in the app or request account deletion, Buhay will delete or de-identify the corresponding information unless retention is required for security, fraud prevention, backup, or legal reasons.',
      'Backups or exports you save on your own device remain under your control after export.',
    ],
  },
  {
    title: 'Your choices and privacy rights',
    paragraphs: [
      'You can review, correct, export, and delete much of your information directly inside the app.',
      'Depending on where you live, privacy laws may give you rights such as access, correction, deletion, objection, restriction, complaint, and data portability, including rights available under Philippine law where relevant.',
    ],
    bullets: [
      'Update profile and account settings in the app.',
      'Use export and backup tools before making major changes or deletion requests.',
      'Contact Buhay if you need help with access, correction, deletion, or a privacy concern.',
    ],
  },
  {
    title: 'Security and international processing',
    paragraphs: [
      'Buhay uses reasonable technical and organizational measures to protect account, money, fitness, and personal reflection data, but no online service can promise absolute security.',
      'Because Buhay relies on third-party infrastructure, your information may be processed or stored outside your home country, including the Philippines or other regions where providers operate. When that happens, Buhay expects those providers to apply appropriate safeguards for the service they provide.',
    ],
  },
  {
    title: 'Children’s privacy',
    paragraphs: [
      'Buhay is not directed to children under 18. If you believe a child has provided personal data without appropriate permission, contact Buhay so the situation can be reviewed and addressed.',
    ],
  },
  {
    title: 'Updates and contact',
    paragraphs: [
      'Buhay may update this policy as the product, infrastructure, or legal requirements change. If a material update is made, the revised version will be posted on this page with an updated effective date.',
      'For privacy questions, data requests, or complaints, use the contact details listed on this page.',
    ],
  },
]

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="Privacy Policy"
      title="How Buhay handles your account and personal tracking data."
      intro="This page explains what Buhay collects, why it is used, which providers help run the product, and how you can access, export, or delete information tied to your account."
      metaTitle="Privacy Policy — Buhay"
      metaDescription="Read how Buhay handles account, money, fitness, reflection, and optional media uploads, and how you can access, export, or delete it."
      metaPath="/privacy"
      summaryPoints={SUMMARY_POINTS}
      sections={SECTIONS}
    />
  )
}
