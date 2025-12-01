import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * Button component following SLAB brand guidelines
 *
 * Variants:
 * - primary: Midnight Blue background (CTAs, primary actions)
 * - secondary: Steel Gray background (secondary actions)
 * - accent: Success Gold background (highlights, achievements)
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-bold transition-all duration-200 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-midnight-blue text-pure-white hover:opacity-90 focus:ring-midnight-blue',
    secondary: 'bg-steel-gray text-pure-white hover:opacity-90 focus:ring-steel-gray',
    accent: 'bg-success-gold text-charcoal hover:opacity-90 focus:ring-success-gold',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return (
    <button className={combinedStyles} {...props}>
      {children}
    </button>
  );
};
