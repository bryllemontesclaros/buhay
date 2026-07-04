import styles from './Button.module.css';

export function Button({ 
  children, 
  variant = 'secondary', 
  className = '', 
  fullWidth = false,
  ...props 
}) {
  const variantClass = styles[`${variant}Btn`] || styles.secondaryBtn;
  const widthClass = fullWidth ? styles.fullWidth : '';
  
  return (
    <button 
      className={`${styles.btn} ${variantClass} ${widthClass} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
