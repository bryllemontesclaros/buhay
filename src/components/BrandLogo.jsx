import { Link } from 'react-router-dom'
import styles from './BrandLogo.module.css'

export default function BrandLogo({ to = '/', showText = true, className = '' }) {
  const content = (
    <span className={`${styles.brand} ${className}`}>
      <span className={styles.brandMark} aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" className={styles.brandSvg}>
          <defs>
            <linearGradient id="buhay-logo-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#162e26" />
              <stop offset="50%" stopColor="#0b1713" />
              <stop offset="100%" stopColor="#050a08" />
            </linearGradient>
            <linearGradient id="buhay-logo-mark" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34f590" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="url(#buhay-logo-bg)" />
          <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15.25" stroke="#34f590" strokeWidth="1.5" strokeOpacity="0.32" />
          <path
            d="M18 14h15.5c6.3 0 10.8 3.7 10.8 9.1 0 3.5-1.9 6.2-5.1 7.6 4.4 1.3 7.1 4.7 7.1 9.2 0 6.4-5.3 10.1-12.8 10.1H18V14Zm13.5 14.5c3.6 0 5.8-1.8 5.8-4.7s-2.2-4.7-5.8-4.7h-7.3v9.4h7.3Zm1.2 15.7c4.1 0 6.6-2 6.6-5.2s-2.5-5.2-6.6-5.2h-8.5v10.4h8.5Z"
            fill="url(#buhay-logo-mark)"
          />
        </svg>
      </span>
      {showText && <span className={styles.brandName}>Buhay</span>}
    </span>
  )

  if (to) {
    return <Link to={to} className={styles.brandLink}>{content}</Link>
  }

  return content
}
