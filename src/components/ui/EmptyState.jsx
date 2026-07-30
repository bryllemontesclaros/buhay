import styles from './EmptyState.module.css';

const ILLUSTRATIONS = {
  takda: (
    <svg className={styles.illustrationSvg} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="42" fill="url(#takdaGlow)" opacity="0.15" />
      <rect x="26" y="32" width="48" height="38" rx="8" stroke="#10b981" strokeWidth="3" fill="none" />
      <circle cx="50" cy="51" r="9" stroke="#10b981" strokeWidth="2.5" fill="none" />
      <circle cx="50" cy="51" r="3" fill="#10b981" />
      <path d="M46 26 L54 26" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 76 L68 76" stroke="#10b981" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <defs>
        <radialGradient id="takdaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  ),
  lakas: (
    <svg className={styles.illustrationSvg} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="42" fill="url(#lakasGlow)" opacity="0.15" />
      <line x1="20" y1="50" x2="80" y2="50" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="34" width="8" height="32" rx="3" fill="#3b82f6" />
      <rect x="64" y="34" width="8" height="32" rx="3" fill="#3b82f6" />
      <rect x="22" y="38" width="5" height="24" rx="2" fill="#60a5fa" />
      <rect x="73" y="38" width="5" height="24" rx="2" fill="#60a5fa" />
      <defs>
        <radialGradient id="lakasGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  ),
  tala: (
    <svg className={styles.illustrationSvg} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="42" fill="url(#talaGlow)" opacity="0.15" />
      <path d="M56 22 A 22 22 0 1 0 78 44 A 18 18 0 1 1 56 22 Z" fill="#c084fc" />
      <path d="M30 32 L32 37 L37 39 L32 41 L30 46 L28 41 L23 39 L28 37 Z" fill="#e9d5ff" opacity="0.85" />
      <path d="M68 64 L69.5 67.5 L73 69 L69.5 70.5 L68 74 L66.5 70.5 L63 69 L66.5 67.5 Z" fill="#c084fc" opacity="0.75" />
      <defs>
        <radialGradient id="talaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="1" />
          <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  ),
  buhay: (
    <svg className={styles.illustrationSvg} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="42" fill="url(#buhayGlow)" opacity="0.15" />
      <circle cx="50" cy="50" r="28" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="4 3" fill="none" />
      <path d="M50 26 L55 45 L74 50 L55 55 L50 74 L45 55 L26 50 L45 45 Z" fill="var(--accent)" />
      <defs>
        <radialGradient id="buhayGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
};

export function EmptyState({ 
  children, 
  title, 
  description, 
  icon, 
  space,
  badge,
  action, 
  className = '', 
  compact = false 
}) {
  const selectedIllustration = space && ILLUSTRATIONS[space] ? ILLUSTRATIONS[space] : null;

  return (
    <div className={`${styles.emptyState} ${compact ? styles.compact : ''} ${space ? styles['space_' + space] : ''} ${className}`}>
      {badge && <span className={styles.badge}>{badge}</span>}
      {selectedIllustration ? (
        <div className={styles.illustrationWrap}>{selectedIllustration}</div>
      ) : icon ? (
        <div className={styles.icon}>{icon}</div>
      ) : null}
      {title && <h4 className={styles.title}>{title}</h4>}
      {description && <p className={styles.description}>{description}</p>}
      {children && <div className={styles.content}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
