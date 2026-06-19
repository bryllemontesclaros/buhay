import { Link } from 'react-router-dom'
import RouteMeta from '../components/RouteMeta'
import { auth } from '../lib/firebase'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_HREF,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR_NAME,
} from '../lib/legal'
import styles from './LegalPage.module.css'

export default function LegalPageLayout({ eyebrow, title, intro, summaryPoints, sections, metaTitle, metaDescription, metaPath }) {
  const isSignedIn = Boolean(auth.currentUser)
  const primaryHref = isSignedIn ? '/app' : '/login'
  const primaryLabel = isSignedIn ? 'Open the app' : 'Start free'

  return (
    <div className={`${styles.page} neo`}>
      <RouteMeta
        title={metaTitle || `${title} — Buhay`}
        description={metaDescription || intro}
        path={metaPath || '/'}
      />
      <a href="#legal-main" className="skipLink">Skip to main content</a>
      <div className={styles.ribbon} aria-hidden="true">
        <div className={styles.ribbonTrack}>
          <span className={styles.ribbonItem}>Privacy and trust · one calm account · clear limits</span>
          <span className={styles.ribbonItem}>Privacy and trust · one calm account · clear limits</span>
          <span className={styles.ribbonItem}>Privacy and trust · one calm account · clear limits</span>
        </div>
      </div>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.navBrand}>
            <span className={styles.navBrandMark} aria-hidden="true">↗</span>
            <span className={styles.navBrandText}>
              <span className={styles.navLogo}>Buhay</span>
              <span className={styles.navTag}>Takda, Lakas, Tala in one account</span>
            </span>
          </Link>
          <div className={styles.navActions}>
            <Link className={styles.navLink} to="/">Home</Link>
            <Link className={styles.navLink} to="/login">Log in</Link>
            <Link className={styles.navButton} to={primaryHref}>{primaryLabel}</Link>
          </div>
        </div>
      </nav>

      <main id="legal-main" className={styles.main}>
        <aside className={styles.sidebar}>
          <section className={styles.summaryCard}>
            <div className={styles.eyebrow}>{eyebrow}</div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.intro}>{intro}</p>

            <dl className={styles.metaList}>
              <div className={styles.metaItem}>
                <dt className={styles.metaLabel}>Last updated</dt>
                <dd className={styles.metaValue}>{LEGAL_LAST_UPDATED}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt className={styles.metaLabel}>Operator</dt>
                <dd className={styles.metaValue}>{LEGAL_OPERATOR_NAME}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt className={styles.metaLabel}>Contact</dt>
                <dd className={styles.metaValue}>
                  <a className={styles.contactLink} href={LEGAL_CONTACT_HREF}>{LEGAL_CONTACT_EMAIL}</a>
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.summaryCard}>
            <div className={styles.summaryHeading}>At a glance</div>
            <ul className={styles.summaryPoints}>
              {summaryPoints.map(point => <li key={point}>{point}</li>)}
            </ul>
          </section>
        </aside>

        <div className={styles.content}>
          {sections.map(section => (
            <section key={section.title} className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <div className={styles.sectionBody}>
                {section.paragraphs?.map(paragraph => (
                  <p key={paragraph} className={styles.sectionParagraph}>{paragraph}</p>
                ))}
                {section.bullets?.length ? (
                  <ul className={styles.sectionList}>
                    {section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>Buhay</div>
            <div className={styles.footerTagline}>Takda, Lakas, and Tala in one calm account.</div>
            <div className={styles.footerCopy}>Privacy and support: <a className={styles.contactLink} href={LEGAL_CONTACT_HREF}>{LEGAL_CONTACT_EMAIL}</a></div>
          </div>
          <div className={styles.footerLinks}>
            <Link className={styles.footerLink} to="/privacy">Privacy Policy</Link>
            <Link className={styles.footerLink} to="/terms">Terms of Use</Link>
            <Link className={styles.footerLink} to={primaryHref}>{primaryLabel}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
