import styles from '../../pages/AppShell.module.css'
import Button from '../ui/Button'

export function ChangelogModal({ changelogData, dismissChangelog }) {
  if (!changelogData) return null

  return (
    <div className={styles.changelogOverlay} onClick={dismissChangelog}>
      <div className={styles.changelogModal} onClick={e => e.stopPropagation()}>
        <div className={styles.changelogIconWrap}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.changelogSparkle}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" fill="currentColor" opacity="0.85" />
            <path d="M5 3v4M3 5h4" />
            <path d="M19 17v4M17 19h4" />
          </svg>
        </div>
        <div className={styles.changelogBadge}>🎉 Buhay Updated</div>
        <h2 className={styles.changelogTitle}>What&apos;s New in Buhay</h2>
        <div className={styles.changelogContent}>
          <p>{(changelogData.message || "We've added some exciting new improvements to your financial cockpit!").replace(/^(feat|fix|refactor|perf|chore|style)\([^)]+\):\s*/i, '').replace(/^(feat|fix|refactor|perf|chore|style):\s*/i, '')}</p>
        </div>
        <div className={styles.changelogActions}>
          <Button type="button" variant="primary" fullWidth onClick={dismissChangelog}>
            Awesome, got it!
          </Button>
        </div>
      </div>
    </div>
  )
}
