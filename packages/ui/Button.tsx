import React from 'react';
import { cn } from './index';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variant === 'primary' && "bg-blue-600 text-white shadow hover:bg-blue-600/90",
          variant === 'secondary' && "bg-neutral-800 text-neutral-100 shadow-sm hover:bg-neutral-800/80",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
