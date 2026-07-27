import { Link, useNavigate } from 'react-router-dom'
import RouteMeta from '../components/RouteMeta'
import { auth } from '../lib/firebase'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_HREF,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR_NAME,
} from '../lib/legal'
import styles from './LegalPage.module.css'
import navStyles from './LandingPageClean.module.css'

export default function LegalPageLayout({ eyebrow, title, intro, summaryPoints, sections, metaTitle, metaDescription, metaPath }) {
  const navigate = useNavigate()
  const isSignedIn = Boolean(auth.currentUser)
  const primaryHref = isSignedIn ? '/app' : '/login'
  const primaryLabel = isSignedIn ? 'Open App' : 'Join Beta'

  return (
    <div className={`${styles.page} neo`}>
      <RouteMeta
        title={metaTitle || `${title} — Buhay`}
        description={metaDescription || intro}
        path={metaPath || '/'}
      />
      <a href="#legal-main" className="skipLink">Skip to main content</a>
      <nav className={navStyles.nav}>
        <div className={navStyles.navInner}>
          <Link to="/" className={navStyles.brand}>
            <span className={navStyles.brandMark}>↗</span>
            <span className={navStyles.brandName}>Buhay</span>
          </Link>
          <div className={navStyles.navActions}>
            {!isSignedIn && (
              <button type="button" className={`${navStyles.btn} ${navStyles.btnGhost}`} onClick={() => navigate('/login')}>
                Sign in
              </button>
            )}
            <Link className={`${navStyles.btn} ${navStyles.btnPrimary}`} to={primaryHref}>
              {primaryLabel}
            </Link>
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

      <footer className={navStyles.footer}>
        <div className={navStyles.footerInner}>
          <p>© {new Date().getFullYear()} Buhay. Bawat araw, mas malinaw.</p>
          <div className={navStyles.footerLinks}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
