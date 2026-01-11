'use client';

import * as React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: Date | string;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = '날짜 선택',
  className,
  disabled,
  min,
  max,
}: DatePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      onChange?.(new Date(dateValue));
    } else {
      onChange?.(undefined);
    }
  };

  const formatValue = () => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.toISOString().split('T')[0];
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="date"
        value={formatValue()}
        onChange={handleChange}
        disabled={disabled}
        min={min}
        max={max}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      />
      <Calendar
        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    </div>
  );
}
