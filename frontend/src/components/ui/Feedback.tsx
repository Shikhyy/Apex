import React from 'react';

// Toast/Alert component
interface ToastProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

export function Toast({
  type,
  title,
  message,
  onClose,
  autoClose = true,
  duration = 3000,
}: ToastProps) {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const typeConfig = {
    success: {
      bg: 'bg-[#0a1a0a]',
      border: 'border-[#34d399]',
      icon: '✓',
      color: 'text-[#34d399]',
    },
    error: {
      bg: 'bg-[#1a0a0a]',
      border: 'border-[#f87171]',
      icon: '✕',
      color: 'text-[#f87171]',
    },
    info: {
      bg: 'bg-[#0a121a]',
      border: 'border-[#60a5fa]',
      icon: 'ℹ',
      color: 'text-[#60a5fa]',
    },
    warning: {
      bg: 'bg-[#1a1512]',
      border: 'border-[#D53E0F]',
      icon: '⚠',
      color: 'text-[#D53E0F]',
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={`
        ${config.bg}
        ${config.border}
        border
        rounded-lg
        p-4
        flex items-start gap-3
        backdrop-blur-sm
        shadow-lg
        animate-slideInRight
      `}
    >
      <span className={`flex-shrink-0 text-lg font-bold ${config.color}`}>
        {config.icon}
      </span>
      <div className="flex-1">
        <h3 className="font-semibold text-[#EED9B9]">{title}</h3>
        {message && <p className="text-sm text-[#888888] mt-0.5">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-[#555555] hover:text-[#EED9B9] transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Tooltip
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={`
            absolute
            ${positionClasses[position]}
            bg-[#0a0a0a]
            border border-[#D53E0F]/50
            text-[#EED9B9]
            text-xs
            px-2 py-1
            rounded
            whitespace-nowrap
            z-50
            animate-fadeIn
            font-mono
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Modal/Dialog
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
}: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`
          ${sizes[size]}
          w-full
          bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]
          border border-[#D53E0F]/30
          rounded-lg
          shadow-2xl
          animate-scaleIn
          overflow-hidden
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#D53E0F]/20">
          <h2 className="text-xl font-bold text-[#EED9B9]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#555555] hover:text-[#D53E0F] transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {actions && (
          <div className="flex justify-end gap-3 p-6 border-t border-[#D53E0F]/20">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// Dropdown Menu
interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  divider?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
}

export function Dropdown({ trigger, items }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hover:text-[#D53E0F] transition-colors"
      >
        {trigger}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`
              absolute
              right-0
              mt-2
              w-48
              bg-[#1a1a1a]
              border border-[#D53E0F]/30
              rounded-lg
              shadow-xl
              overflow-hidden
              z-50
              animate-slideInUp
            `}
          >
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.divider && (
                  <div className="h-px bg-[#D53E0F]/20 my-1"></div>
                )}
                <button
                  onClick={() => {
                    item.onClick();
                    setIsOpen(false);
                  }}
                  className={`
                    w-full
                    px-4 py-2
                    text-left
                    text-sm
                    flex items-center gap-2
                    transition-colors
                    hover:bg-[#D53E0F]/10
                    ${item.danger ? 'text-[#f87171] hover:text-[#f87171]' : 'text-[#EED9B9]'}
                  `}
                >
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
