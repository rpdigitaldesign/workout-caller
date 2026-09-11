import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-black hover:bg-accent-strong',
  secondary: 'bg-surface-raised text-text border border-border hover:bg-border',
  danger: 'bg-danger text-black hover:opacity-90',
  ghost: 'bg-transparent text-text-muted hover:text-text',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'px-4 py-2.5 text-sm min-h-11',
  lg: 'px-6 py-4 text-lg min-h-14',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  ref?: Ref<HTMLButtonElement>;
};

// React 19 allows function components to accept `ref` as a plain prop —
// no forwardRef wrapper needed.
export function Button({ variant = 'primary', size = 'md', className = '', ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
