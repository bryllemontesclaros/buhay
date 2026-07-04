import styles from './EmptyState.module.css';

export function EmptyState({ 
  children, 
  title, 
  description, 
  icon, 
  action, 
  className = '', 
  compact = false 
}) {
  return (
    <div className={`${styles.emptyState} ${compact ? styles.compact : ''} ${className}`}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <h4 className={styles.title}>{title}</h4>}
      {description && <p className={styles.description}>{description}</p>}
      {children && <div className={styles.content}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
