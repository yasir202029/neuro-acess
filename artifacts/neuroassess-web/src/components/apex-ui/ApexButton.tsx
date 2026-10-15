/**
 * ApexButton — primary action button for the clinical workstation.
 *
 * Uses the clinical blue accent colour with clear hover states.
 */

import { cn } from '@/lib/utils';

export function ApexButton({
  className,
  children,
  disabled,
  onClick,
  variant,
}: {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const variantClasses: Record<string, string> = {
    primary:
      'bg-apex-clinical-blue text-white hover:bg-[hsl(var(--apex-clinical-blue))/0.9]',
    secondary:
      'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/0.9',
    danger:
      'bg-[hsl(var(--apex-critical-red))] text-white hover:bg-[hsl(var(--apex-critical-red))/0.9]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
        variantClasses[variant ?? 'primary'],
        className,
      )}
    >
      {children}
    </button>
  );
}
