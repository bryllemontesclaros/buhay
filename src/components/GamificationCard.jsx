import { displayValue } from '../lib/utils'
import styles from './GamificationCard.module.css'

export default function GamificationCard({
  gamification,
  privacyMode = false,
  title = 'Money momentum',
  message,
  compact = false,
}) {
  if (!gamification) return null

  const expLabel = displayValue(privacyMode, `${gamification.totalExp} EXP`, '•••• EXP')
  const monthDelta = gamification.monthNetExp
  const deltaLabel = monthDelta >= 0 ? `+${monthDelta} EXP this month` : `${monthDelta} EXP this month`
  const streakLabel = gamification.currentStreakDays > 0
    ? `${gamification.currentStreakDays}-day streak`
    : 'Check in today to start a streak'
  const weeklyLabel = `${gamification.weeklyCheckins}/${gamification.weeklyTarget} days checked in this week`

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.eyebrow}>{title}</div>
          <div className={styles.level}>Level {gamification.level}</div>
        </div>
        <div className={styles.exp}>{expLabel}</div>
      </div>
      <div className={styles.message}>{message || gamification.message}</div>
      <div className={styles.badgeRow}>
        <div className={styles.statChip}>{streakLabel}</div>
        <div className={styles.statChip}>{weeklyLabel}</div>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${gamification.progressPct}%` }} />
      </div>
      <div className={styles.metaRow}>
        <div className={styles.meta}>
          {displayValue(
            privacyMode,
            `${gamification.currentLevelExp}/${gamification.nextLevelTarget} to next level`,
            '•••• to next level',
          )}
        </div>
        <div className={styles.meta}>
          {displayValue(privacyMode, gamification.nextMilestone, 'Milestone hidden')}
        </div>
        <div className={styles.pill}>{displayValue(privacyMode, deltaLabel, 'Monthly EXP hidden')}</div>
      </div>
    </div>
  )
}
