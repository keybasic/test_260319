import { forwardRef } from 'react';

/**
 * 재사용 가능한 버튼 컴포넌트
 * variant: primary | secondary | outline | ghost
 * size: sm | md | lg
 */
const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      disabled = false,
      className = '',
      leftIcon: LeftIcon,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
      primary:
        'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800',
      secondary:
        'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400',
      outline:
        'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
      ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
    };
    const sizes = {
      sm: 'text-sm px-3 py-1.5',
      md: 'text-sm px-4 py-2',
      lg: 'text-base px-6 py-3',
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {LeftIcon && <LeftIcon className="w-4 h-4 shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
