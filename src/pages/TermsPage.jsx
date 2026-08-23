import LegalPageLayout from './LegalPageLayout'

const SUMMARY_POINTS = [
  'Buhay is a personal financial planning and cashflow tracking software, not a bank, broker, or licensed financial advisor.',
  'You remain responsible for verifying your manual transaction logs, bill schedules, and financial decisions.',
  'These terms outline account responsibilities, acceptable use, data backups, and service availability.',
]

const SECTIONS = [
  {
    title: 'Using Buhay',
    paragraphs: [
      'These Terms of Use govern your access to the Buhay website, applications, and services. By accessing or using Buhay, you agree to be bound by these Terms and our Privacy Policy.',
      'Buhay is designed to help individuals track their daily cashflow, plan upcoming bills, monitor envelope budgets, and visualize multi-account net worth with total privacy.',
    ],
  },
  {
    title: 'Eligibility and account security',
    bullets: [
      'You must provide accurate account registration details and maintain the security and confidentiality of your login credentials.',
      'You are solely responsible for all activities and entries that occur under your account.',
      'If you detect unauthorized access or suspect a security breach, reset your password and notify us immediately.',
    ],
  },
  {
    title: 'What Buhay is and is not',
    bullets: [
      'Buhay is a self-directed personal tracking tool for manual financial bookkeeping, cashflow calendar projection, and debt payoff planning.',
      'Buhay is not a bank, depository institution, payment processor, lender, insurance broker, or registered investment advisory service.',
      'Buhay does not provide legal, tax, accounting, or formal financial investment advice.',
      'All automated calculations, including 30-day cash projections, lowest dip calculations, savings timelines, and debt payoff dates, are informational projections based on user-entered data. You remain responsible for all financial decisions.',
    ],
  },
  {
    title: 'Your data ownership and responsibilities',
    paragraphs: [
      'You retain full and exclusive ownership of all financial transactions, account names, and notes you enter into Buhay. You grant Buhay only the limited rights necessary to host, process, calculate, and display your data to provide the service.',
    ],
    bullets: [
      'Ensure manual entries and transaction amounts are accurate before relying on forecasting models.',
      'Do not submit unlawful, harmful, or malicious code through the application.',
      'Do not attempt to reverse engineer, disrupt, or gain unauthorized access to our infrastructure or other users\' data.',
    ],
  },
  {
    title: 'Third-party infrastructure',
    paragraphs: [
      'Buhay utilizes trusted third-party infrastructure providers to deliver reliable, high-speed hosting and encrypted data persistence.',
    ],
    bullets: [
      'Google Firebase for authentication and database management.',
      'Vercel for web hosting and content delivery.',
    ],
  },
  {
    title: 'Service availability and product evolution',
    bullets: [
      'We continuously improve Buhay by adding new tools, enhancing algorithms, and optimizing performance.',
      'While we strive for 99.9% uptime, services may occasionally experience temporary interruptions for maintenance, system updates, or infrastructure outages.',
      'We reserve the right to modify or update these Terms as the application evolves. Continued use following an update constitutes acceptance of the revised Terms.',
    ],
  },
  {
    title: 'Data exports, backups, and termination',
    bullets: [
      'Buhay provides 1-click CSV spreadsheet exports and encrypted JSON backup downloads in the Settings page. Users are encouraged to maintain local backup copies of their records.',
      'You may discontinue use of the service or permanently delete your account and all associated data at any time.',
      'We reserve the right to suspend or terminate accounts that violate these Terms or engage in abusive, fraudulent behavior.',
    ],
  },
  {
    title: 'Disclaimers and limitation of liability',
    paragraphs: [
      'Buhay is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. While we strive to maintain accurate forecasting engines, we cannot guarantee zero errors in user-entered projections or system calculations.',
      'To the maximum extent permitted by law, Buhay and its operators shall not be liable for any direct, indirect, incidental, consequential, or punitive damages resulting from reliance on forecast projections or data loss.',
    ],
  },
  {
    title: 'Applicable law and contact',
    paragraphs: [
      'These Terms shall be governed by and construed in accordance with applicable laws, including the laws of the Republic of the Philippines where relevant to Buhay\'s operation.',
      'For any questions or concerns regarding these Terms, please contact support@takda.app.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Terms of Use"
      title="The terms and standards for using Buhay."
      intro="These terms explain what Buhay provides, our zero bank password policy, your responsibilities regarding data accuracy, and our guidelines for data portability and service access."
      metaTitle="Terms of Use — Buhay"
      metaDescription="Read the terms of use for Buhay, covering self-directed personal finance tracking, data ownership, third-party infrastructure, and forecasting disclaimers."
      metaPath="/terms"
      summaryPoints={SUMMARY_POINTS}
      sections={SECTIONS}
    />
  )
}
