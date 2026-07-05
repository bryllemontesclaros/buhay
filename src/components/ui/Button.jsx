import styles from './Button.module.css';

export function Button({ 
  children, 
  variant = 'secondary', 
  size = 'md',
  className = '', 
  fullWidth = false,
  ...props 
}) {
  const variantClass = styles[`${variant}Btn`] || styles.secondaryBtn;
  const sizeClass = size === 'sm' ? styles.btnSm : '';
  const widthClass = fullWidth ? styles.fullWidth : '';
  
  return (
    <button 
      className={`${styles.btn} ${variantClass} ${sizeClass} ${widthClass} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
