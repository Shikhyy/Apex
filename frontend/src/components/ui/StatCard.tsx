import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  animated?: boolean;
  variant?: 'default' | 'burn' | 'success';
}

export function StatCard({
  title,
  value,
  unit,
  change,
  trend = 'neutral',
  icon,
  animated = true,
  variant = 'default',
}: StatCardProps) {
  const variants = {
    default: 'border-[#D53E0F]/30 hover:border-[#D53E0F]/60',
    burn: 'border-[#D53E0F]/50 bg-gradient-to-br from-[#D53E0F]/5 to-transparent hover:from-[#D53E0F]/10',
    success: 'border-[#34d399]/30 hover:border-[#34d399]/60',
  };

  const trendColors = {
    up: 'text-[#34d399]',
    down: 'text-[#f87171]',
    neutral: 'text-[#888888]',
  };

  return (
    <div
      className={`
        relative
        group
        p-6
        rounded-lg
        border
        ${variants[variant]}
        bg-[#0a0a0a]/50
        backdrop-blur-sm
        transition-all duration-500
        hover:shadow-lg hover:shadow-[#D53E0F]/10
        ${animated ? 'animate-slideInUp opacity-0' : 'opacity-100'}
        overflow-hidden
      `}
      style={animated ? { animation: 'slideUp 0.6s ease-out forwards' } : {}}
    >
      {/* Background glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D53E0F]/5 via-transparent to-transparent blur-2xl"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-[#888888] uppercase tracking-widest mb-1">
              {title}
            </p>
            <h3 className="text-3xl font-bold text-[#EED9B9] font-display">
              {value}
              {unit && <span className="text-base text-[#D53E0F] ml-1">{unit}</span>}
            </h3>
          </div>
          {icon && (
            <div className="text-2xl text-[#D53E0F] opacity-50 group-hover:opacity-100 transition-opacity duration-300">
              {icon}
            </div>
          )}
        </div>

        {/* Trend indicator */}
        {change !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-bold ${trendColors[trend]}`}>
              {trend === 'up' ? '+' : ''}{change.toFixed(2)}%
            </span>
            <span className="text-[#555555]">vs last cycle</span>
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#D53E0F] to-transparent group-hover:h-1 transition-all duration-500 w-full"></div>
    </div>
  );
}

// Metric Grid
interface MetricGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
}

export function MetricGrid({ children, cols = 3 }: MetricGridProps) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${colClasses[cols]} gap-4 auto-rows-[1fr]`}>
      {children}
    </div>
  );
}

// Progress Badge
interface ProgressBadgeProps {
  label: string;
  value: number;
  max?: number;
  animated?: boolean;
}

export function ProgressBadge({ label, value, max = 100, animated = true }: ProgressBadgeProps) {
  const percentage = (value / max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-[#888888] uppercase tracking-wide">{label}</span>
        <span className="text-sm font-bold text-[#D53E0F]">{percentage.toFixed(0)}%</span>
      </div>
      <div className="relative h-2 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#D53E0F]/20">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D53E0F] to-[#9B0F06] rounded-full transition-all duration-700"
          style={{
            width: `${percentage}%`,
            animation: animated ? 'progressFill 1s ease-out' : 'none',
          }}
        ></div>
      </div>
    </div>
  );
}

// Feature Card
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function FeatureCard({
  icon,
  title,
  description,
  onClick,
  disabled = false,
}: FeatureCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group
        p-6
        rounded-lg
        border
        border-[#D53E0F]/20
        bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]
        text-left
        transition-all duration-500
        hover:border-[#D53E0F]/60
        hover:shadow-lg hover:shadow-[#D53E0F]/20
        hover:bg-gradient-to-br hover:from-[#1a1a1a]/50 hover:to-[#0a0a0a]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${onClick ? 'hover:translate-y-[-2px]' : ''}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl text-[#D53E0F] flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-[#EED9B9] text-lg mb-1 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-[#888888] leading-relaxed ">{description}</p>
        </div>
      </div>
    </button>
  );
}
