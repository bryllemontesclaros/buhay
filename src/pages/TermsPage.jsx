import LegalPageLayout from './LegalPageLayout'

const SUMMARY_POINTS = [
  'Buhay is a tracking tool, not a bank, clinic, coach, or advice service.',
  'You remain responsible for reviewing what you log or import before relying on it.',
  'These terms explain access, acceptable use, backups, service changes, and account closure.',
]

const SECTIONS = [
  {
    title: 'Using Buhay',
    paragraphs: [
      'These Terms of Use govern your access to the Buhay website, signup flow, and app. By using Buhay, you agree to these terms and to the Privacy Policy.',
      'Buhay is designed to help you track money, fitness, reflection, planning, manual receipts, and screenshot-assisted finance review in one app.',
    ],
  },
  {
    title: 'Eligibility and accounts',
    bullets: [
      'You must provide accurate account information and keep your login credentials secure.',
      'You are responsible for activity that happens through your account unless caused by Buhay’s own failure to protect it.',
      'If you suspect unauthorized access, reset your password and contact Buhay as soon as possible.',
    ],
  },
  {
    title: 'What Buhay is and is not',
    bullets: [
      'Buhay is a personal tracking and planning tool for money, fitness, reflection, and everyday life.',
      'Buhay is not a bank, e-wallet, lender, insurer, brokerage, or regulated investment service.',
      'Buhay is not a doctor, dietitian, therapist, coach, or emergency-support service.',
      'Buhay does not provide financial, investment, legal, tax, accounting, medical, mental-health, nutrition, or fitness advice.',
      'Forecasts, bills, recurring schedules, budgets, goals, fitness logs, mood insights, and gamified progress are informational tools. You remain responsible for verifying your own finances, health decisions, and personal decisions.',
    ],
  },
  {
    title: 'Your data and responsibilities',
    paragraphs: [
      'You keep ownership of the content and information you add to Buhay. You give Buhay the limited rights needed to host, process, back up, transmit, and display that information in order to operate the product.',
    ],
    bullets: [
      'Review screenshot-assisted imports and manual entries before saving them.',
      'Do not upload or submit unlawful, abusive, infringing, or harmful material.',
      'Do not interfere with the service, abuse automated flows, or attempt unauthorized access to Buhay or other users’ data.',
    ],
  },
  {
    title: 'Third-party services',
    paragraphs: [
      'Buhay depends on third-party providers for infrastructure and certain features. Those providers may have their own terms and privacy practices.',
    ],
    bullets: [
      'Firebase may be used for authentication and app data storage.',
      'Vercel or similar infrastructure may be used to host the site or app.',
    ],
  },
  {
    title: 'Availability, updates, and product changes',
    bullets: [
      'Buhay may add, remove, pause, or change features to improve the service, address risk, or comply with law.',
      'The service may be unavailable from time to time for maintenance, bugs, provider outages, or security issues.',
      'Buhay may update these terms when the product or legal environment changes. Continued use after an update means you accept the revised terms.',
    ],
  },
  {
    title: 'Backups, exports, and deletion',
    bullets: [
      'Buhay may offer export, backup, or restore tools, but you should keep your own copies of important records.',
      'You may stop using the product at any time and may request account deletion where that feature is available.',
      'Buhay may suspend or terminate access if the service is misused, if legal compliance requires it, or if continued access creates security or fraud risk.',
    ],
  },
  {
    title: 'Disclaimers and limits',
    paragraphs: [
      'Buhay is provided on an as-is and as-available basis to the extent allowed by applicable law. Buhay works to make the product useful and reliable, but cannot guarantee uninterrupted service, perfectly accurate screenshot-assisted entries, or error-free forecasts.',
      'To the fullest extent allowed by law, Buhay is not liable for indirect, incidental, special, consequential, or punitive damages, or for losses caused by reliance on inaccurate entries, screenshot-assisted imports, or forecasts that you did not review.',
    ],
  },
  {
    title: 'Applicable law and contact',
    paragraphs: [
      'These terms should be read together with the laws that apply where you use the product, including Philippine law where relevant to Buhay’s operation.',
      'Questions about these terms can be sent to the contact details listed on this page.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Terms of Use"
      title="The rules for using Buhay."
      intro="These terms explain what Buhay provides, what it does not provide, what you remain responsible for, and how account access, third-party providers, backups, and service changes are handled."
      metaTitle="Terms of Use — Buhay"
      metaDescription="Read the terms for using Buhay, including account responsibilities, screenshot-assisted review, third-party services, forecasts, backups, and service changes."
      metaPath="/terms"
      summaryPoints={SUMMARY_POINTS}
      sections={SECTIONS}
    />
  )
}
