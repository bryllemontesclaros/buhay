import styles from './EmptyState.module.css';

const ILLUSTRATIONS = {
  buhay: (
    <svg className={styles.illustrationSvg} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="42" fill="url(#buhayGlow)" opacity="0.15" />
      <rect x="26" y="32" width="48" height="38" rx="8" stroke="#10b981" strokeWidth="3" fill="none" />
      <circle cx="50" cy="51" r="9" stroke="#10b981" strokeWidth="2.5" fill="none" />
      <circle cx="50" cy="51" r="3" fill="#10b981" />
      <path d="M46 26 L54 26" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 76 L68 76" stroke="#10b981" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <defs>
        <radialGradient id="buhayGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
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
