import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'burn' | 'crimson';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'default',
  size = 'md',
  pulse = false,
  icon,
  children,
  className = '',
}: BadgeProps) {
  const variants = {
    default: `
      bg-[#1a1a1a]
      text-[#EED9B9]
      border border-[#D53E0F]/30
    `,
    success: `
      bg-[#0a1a0a]
      text-[#34d399]
      border border-[#34d399]/30
    `,
    warning: `
      bg-[#1a1512]
      text-[#D53E0F]
      border border-[#D53E0F]/50
    `,
    danger: `
      bg-[#1a0a0a]
      text-[#f87171]
      border border-[#f87171]/30
    `,
    info: `
      bg-[#0a121a]
      text-[#60a5fa]
      border border-[#60a5fa]/30
    `,
    burn: `
      bg-gradient-to-r from-[#D53E0F]/20 to-[#9B0F06]/20
      text-[#EED9B9]
      border border-[#D53E0F]/50
      ${pulse ? 'animate-pulse-burn' : ''}
    `,
    crimson: `
      bg-gradient-to-r from-[#5E0006]/20 to-[#9B0F06]/20
      text-[#EED9B9]
      border border-[#D53E0F]/30
    `,
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  return (
    <span
      className={`
        ${variants[variant]}
        ${sizes[size]}
        rounded-full
        inline-flex
        items-center
        gap-1.5
        font-semibold
        transition-all duration-300
        ${className}
      `}
    >
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
}

// Status Badge
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'error' | 'success';
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusConfig = {
    active: { color: 'text-[#34d399]', bg: 'bg-[#0a1a0a]', dot: 'bg-[#34d399]', label: 'Active' },
    inactive: { color: 'text-[#888888]', bg: 'bg-[#1a1a1a]', dot: 'bg-[#555555]', label: 'Inactive' },
    pending: { color: 'text-[#f59e0b]', bg: 'bg-[#1a1512]', dot: 'bg-[#f59e0b] animate-pulse', label: 'Pending' },
    error: { color: 'text-[#f87171]', bg: 'bg-[#1a0a0a]', dot: 'bg-[#f87171]', label: 'Error' },
    success: { color: 'text-[#34d399]', bg: 'bg-[#0a1a0a]', dot: 'bg-[#34d399]', label: 'Success' },
  };

  const config = statusConfig[status];

  return (
    <div className={`${config.bg} ${config.color} rounded-full px-3 py-1 inline-flex items-center gap-2 text-sm border border-current/20`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
      {label || config.label}
    </div>
  );
}

// Stat Badge
interface StatBadgeProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export function StatBadge({ label, value, trend, icon }: StatBadgeProps) {
  const trendColors = {
    up: 'text-[#34d399]',
    down: 'text-[#f87171]',
    neutral: 'text-[#888888]',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#D53E0F]/20 hover:border-[#D53E0F]/50 transition-all">
      {icon && <span className="text-[#D53E0F]">{icon}</span>}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#888888] font-mono">{label}</span>
        <span className="text-sm font-bold text-[#EED9B9]">{value}</span>
        {trend && (
          <span className={`text-xs font-bold ${trendColors[trend]}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
}
