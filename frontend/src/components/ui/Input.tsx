import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'burn' | 'success';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, variant = 'default', className = '', ...props }, ref) => {
    const variants = {
      default: `
        border-[#D53E0F]/20
        focus:border-[#D53E0F]/60
        focus:ring-[#D53E0F]/20
      `,
      burn: `
        border-[#D53E0F]/40
        focus:border-[#D53E0F]
        focus:ring-[#D53E0F]/30
      `,
      success: `
        border-[#34d399]/30
        focus:border-[#34d399]
        focus:ring-[#34d399]/20
      `,
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-[#EED9B9] mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D53E0F]/50">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full
              px-4 py-2
              ${icon ? 'pl-10' : ''}
              bg-[#0a0a0a]/50
              border
              rounded-lg
              text-[#EED9B9]
              placeholder-[#555555]
              transition-all duration-300
              focus:outline-none
              focus:ring-2
              font-mono
              text-sm
              ${variants[variant]}
              ${error ? 'border-[#f87171] focus:border-[#f87171] focus:ring-[#f87171]/20' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-xs text-[#f87171]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-[#888888]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-[#EED9B9] mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full
            px-4 py-2
            bg-[#0a0a0a]/50
            border border-[#D53E0F]/20
            rounded-lg
            text-[#EED9B9]
            placeholder-[#555555]
            transition-all duration-300
            focus:outline-none
            focus:ring-2
            focus:border-[#D53E0F]/60
            focus:ring-[#D53E0F]/20
            font-mono
            text-sm
            resize-vertical
            ${error ? 'border-[#f87171] focus:border-[#f87171] focus:ring-[#f87171]/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[#f87171]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-[#888888]">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-[#EED9B9] mb-2">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full
            px-4 py-2
            bg-[#0a0a0a]/50
            border border-[#D53E0F]/20
            rounded-lg
            text-[#EED9B9]
            transition-all duration-300
            focus:outline-none
            focus:ring-2
            focus:border-[#D53E0F]/60
            focus:ring-[#D53E0F]/20
            font-mono
            text-sm
            cursor-pointer
            ${error ? 'border-[#f87171] focus:border-[#f87171] focus:ring-[#f87171]/20' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-xs text-[#f87171]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Checkbox
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random()}`;

    return (
      <div className={className}>
        <div className="flex items-center gap-3">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={`
              w-4 h-4
              rounded
              border border-[#D53E0F]/30
              bg-[#0a0a0a]
              cursor-pointer
              accent-[#D53E0F]
              transition-all duration-300
              focus:outline-none
              focus:ring-2
              focus:ring-[#D53E0F]/30
              ${error ? 'border-[#f87171]' : ''}
            `}
            {...props}
          />
          {label && (
            <label htmlFor={checkboxId} className="text-sm text-[#EED9B9] cursor-pointer">
              {label}
            </label>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-[#f87171]">{error}</p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
