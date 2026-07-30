import React from 'react'
import styles from './Skeleton.module.css'

export default function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  style,
}) {
  const isCircle = variant === 'circle'
  const isCard = variant === 'card'

  const classes = [
    styles.skeleton,
    isCircle ? styles.circle : '',
    isCard ? styles.card : '',
    className,
  ].filter(Boolean).join(' ')

  const inlineStyles = {
    width: width || (isCircle ? '40px' : '100%'),
    height: height || (isCircle ? '40px' : isCard ? '160px' : '16px'),
    ...style,
  }

  return <div className={classes} style={inlineStyles} aria-hidden="true" />
}
