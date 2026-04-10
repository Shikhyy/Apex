import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    isLoading = false, 
    icon,
    className = '',
    children,
    disabled,
    ...props 
  }, ref) => {
    const variants = {
      primary: `
        bg-gradient-to-r from-[#D53E0F] to-[#9B0F06]
        text-white
        border border-[#D53E0F]
        hover:shadow-lg hover:shadow-[#D53E0F]/30
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
      `,
      secondary: `
        bg-gradient-to-r from-[#5E0006] to-[#9B0F06]
        text-[#EED9B9]
        border border-[#9B0F06]
        hover:border-[#D53E0F]
        hover:shadow-lg hover:shadow-[#9B0F06]/20
        active:scale-95
      `,
      danger: `
        bg-[#5E0006]
        text-[#EED9B9]
        border border-[#D53E0F]
        hover:bg-[#9B0F06]
        hover:shadow-lg hover:shadow-[#D53E0F]/30
        active:scale-95
      `,
      ghost: `
        text-[#D53E0F]
        border border-transparent
        hover:border-[#D53E0F]/30
        hover:bg-[#D53E0F]/5
        active:scale-95
      `,
      outline: `
        bg-transparent
        text-[#EED9B9]
        border-2 border-[#D53E0F]
        hover:bg-[#D53E0F]/10
        hover:shadow-lg hover:shadow-[#D53E0F]/20
        active:scale-95
      `,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm rounded',
      md: 'px-4 py-2 text-base rounded-md',
      lg: 'px-6 py-3 text-lg rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={`
          ${variants[variant]}
          ${sizes[size]}
          font-semibold
          transition-all duration-300 ease-out
          flex items-center justify-center gap-2
          font-mono tracking-wider
          relative
          overflow-hidden
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="animate-spin">⟳</span>
        ) : icon ? (
          icon
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'md', className = '', ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8 p-1.5',
      md: 'w-10 h-10 p-2',
      lg: 'w-12 h-12 p-2.5',
    };

    return (
      <button
        ref={ref}
        className={`
          ${sizes[size]}
          rounded-lg
          border border-[#D53E0F]/30
          bg-[#0a0a0a]
          text-[#D53E0F]
          hover:bg-[#D53E0F]/10
          hover:border-[#D53E0F]
          transition-all duration-300
          flex items-center justify-center
          ${className}
        `}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
