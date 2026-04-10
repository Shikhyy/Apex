import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'glowing' | 'gradient';
  interactive?: boolean;
}

export function Card({
  children,
  className = '',
  variant = 'default',
  interactive = false,
}: CardProps) {
  const variants = {
    default: `
      bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]
      border border-[#2a2a2a]
      rounded-lg
      transition-all duration-300
      ${interactive ? 'hover:border-[#D53E0F] hover:shadow-lg' : ''}
    `,
    bordered: `
      bg-[#0a0a0a]
      border-2 border-[#D53E0F]
      rounded-lg
      transition-all duration-300
      hover:glow-animation
      ${interactive ? 'hover:shadow-lg hover:shadow-[#D53E0F]/20' : ''}
    `,
    glowing: `
      bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]
      border border-[#D53E0F]/30
      rounded-lg
      animate-glow
      shadow-lg shadow-[#D53E0F]/20
      transition-all duration-300
      ${interactive ? 'hover:animate-glowBorder' : ''}
    `,
    gradient: `
      bg-gradient-to-br from-[#D53E0F]/10 via-[#5E0006]/20 to-[#0a0a0a]
      border border-[#D53E0F]/30
      rounded-lg
      transition-all duration-300
      ${interactive ? 'hover:from-[#D53E0F]/15 hover:via-[#5E0006]/25' : ''}
    `,
  };

  return (
    <div className={`${variants[variant]} ${className} p-6`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-4 pt-4 border-t border-[#2a2a2a] ${className}`}>{children}</div>;
}
