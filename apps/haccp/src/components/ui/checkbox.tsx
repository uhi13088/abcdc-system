'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="flex items-center">
        <div className="relative">
          <input
            type="checkbox"
            id={inputId}
            ref={ref}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'h-4 w-4 shrink-0 rounded-sm border border-gray-300 bg-white ring-offset-background transition-colors',
              'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              'peer-checked:border-primary peer-checked:bg-primary',
              className
            )}
          >
            <Check className="h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 absolute top-0 left-0" />
          </div>
        </div>
        {label && (
          <label
            htmlFor={inputId}
            className="ml-2 text-sm text-gray-700 cursor-pointer"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
