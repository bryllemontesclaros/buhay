import React from 'react'
import styles from './Input.module.css'

export default function Input({
  label,
  type = 'text',
  error,
  prefix,
  className = '',
  wrapperClassName = '',
  children,
  ...props
}) {
  const isSelect = type === 'select'
  const isTextarea = type === 'textarea'

  const inputClasses = [
    isSelect ? styles.select : isTextarea ? styles.textarea : styles.input,
    error ? styles.inputError : '',
    prefix ? styles.hasPrefix : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={`${styles.inputGroup} ${wrapperClassName}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        {isSelect ? (
          <select className={inputClasses} {...props}>
            {children}
          </select>
        ) : isTextarea ? (
          <textarea className={inputClasses} {...props} />
        ) : (
          <input type={type} className={inputClasses} {...props} />
        )}
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  )
}
