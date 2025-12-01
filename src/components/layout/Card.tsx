import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Card component for content grouping
 *
 * Variants:
 * - default: White background with subtle border
 * - outlined: Midnight Blue border
 * - elevated: White background with shadow
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}) => {
  const baseStyles = 'bg-pure-white rounded-lg';

  const variantStyles = {
    default: 'border border-gray-200',
    outlined: 'border-2 border-midnight-blue',
    elevated: 'shadow-lg',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`;

  return <div className={combinedStyles}>{children}</div>;
};
