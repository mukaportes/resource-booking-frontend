'use client';

import { DayPicker } from 'react-day-picker';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('atlas-date-picker', className)}
      {...props}
    />
  );
}
