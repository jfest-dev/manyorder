import { useState } from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function Button({ 
  children, 
  variant = 'primary', 
  onClick, 
  fullWidth,
  disabled 
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getStyles = () => {
    const baseStyles = {
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      fontSize: '13px',
      fontWeight: 500,
      outline: 'none',
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled ? 0.5 : 1,
    };

    if (variant === 'primary') {
      return {
        ...baseStyles,
        background: isHovered && !disabled ? 'var(--primary-solid-hover)' : 'var(--primary-solid)',
        color: 'var(--text-on-dark)',
      };
    }

    if (variant === 'secondary') {
      return {
        ...baseStyles,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-strong)',
      };
    }

    // ghost
    return {
      ...baseStyles,
      background: isHovered && !disabled ? 'var(--bg-card-subtle)' : 'transparent',
      color: 'var(--text-primary)',
    };
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      style={getStyles()}
    >
      {children}
    </button>
  );
}
