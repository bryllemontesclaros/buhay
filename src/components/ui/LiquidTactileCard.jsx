import React, { useRef, useState } from 'react'
import styles from './LiquidTactileCard.module.css'

export function LiquidTactileCard({
  title,
  subtitle,
  value,
  trend,
  trendDirection = 'up', // 'up' | 'down' | 'neutral'
  icon,
  action,
  accentColor = 'var(--accent)',
  children,
  className = '',
  onClick,
  ...props
}) {
  const cardRef = useRef(null)
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50, opacity: 0 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setCursorPos({ x, y, opacity: 1 })
  }

  const handleMouseLeave = () => {
    setCursorPos((prev) => ({ ...prev, opacity: 0 }))
  }

  return (
    <div
      ref={cardRef}
      className={`${styles.glassCard} ${onClick ? styles.interactive : ''} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      {...props}
    >
      {/* Specular Radial Light Reflector */}
      <div
        className={styles.glowReflector}
        style={{
          background: `radial-gradient(160px circle at ${cursorPos.x}% ${cursorPos.y}%, ${accentColor} 0%, transparent 70%)`,
          opacity: cursorPos.opacity * 0.18,
        }}
      />

      {/* Top Specular Highlight Edge */}
      <div
        className={styles.topEdgeHighlight}
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
          opacity: cursorPos.opacity * 0.6,
        }}
      />

      {/* Card Header */}
      {(title || icon) && (
        <div className={styles.cardHeader}>
          <div className={styles.titleWrap}>
            {icon && <span className={styles.cardIcon}>{icon}</span>}
            <div>
              {title && <h3 className={styles.cardTitle}>{title}</h3>}
              {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
            </div>
          </div>
          {action && <div className={styles.headerAction}>{action}</div>}
        </div>
      )}

      {/* Financial Readout Body */}
      {value !== undefined && (
        <div className={styles.valueRow}>
          <span className={styles.financialValue}>{value}</span>
          {trend && (
            <span
              className={`${styles.trendBadge} ${
                trendDirection === 'up'
                  ? styles.trendUp
                  : trendDirection === 'down'
                  ? styles.trendDown
                  : styles.trendNeutral
              }`}
            >
              {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '•'} {trend}
            </span>
          )}
        </div>
      )}

      {/* Custom Body Content */}
      {children && <div className={styles.cardBody}>{children}</div>}
    </div>
  )
}
