import { Link } from 'react-router-dom'
import styles from './BrandLogo.module.css'

export default function BrandLogo({ to = '/', showText = true, className = '' }) {
  const content = (
    <span className={`${styles.brand} ${className}`}>
      <span className={styles.brandMark} aria-hidden="true">↗</span>
      {showText && <span className={styles.brandName}>Buhay</span>}
    </span>
  )

  if (to) {
    return <Link to={to} className={styles.brandLink}>{content}</Link>
  }

  return content
}
