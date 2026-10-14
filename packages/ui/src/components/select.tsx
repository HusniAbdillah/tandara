import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = forwardRef<
  ElementRef<typeof SelectPrimitive.Value>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn('min-w-0 truncate data-[placeholder]:text-[#718087]', className)}
    {...props}
  />
));
SelectValue.displayName = SelectPrimitive.Value.displayName;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'group inline-flex h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-[#e3dfd6] bg-white px-3.5 text-left text-sm font-medium text-[#10303d] shadow-[0_1px_1px_rgb(16_48_61/4%)] outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#7fb3b8] focus-visible:border-[#1f6f7a] focus-visible:ring-4 focus-visible:ring-[#1f6f7a]/15 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-[#718087] [&>span]:min-w-0 [&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        aria-hidden="true"
        className="size-4 shrink-0 text-[#55656b] transition-transform duration-150 group-data-[state=open]:rotate-180"
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', sideOffset = 6, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[10px] border border-[#e3dfd6] bg-white p-1.5 text-[#10303d] shadow-[0_12px_30px_rgb(16_48_61/14%),0_2px_6px_rgb(16_48_61/6%)] outline-none transition-[opacity,transform] duration-100 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center text-[#55656b]">
        <ChevronUp aria-hidden="true" className="size-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-0.5">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center text-[#55656b]">
        <ChevronDown aria-hidden="true" className="size-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex min-h-10 w-full cursor-default select-none items-center rounded-md py-2 pl-3 pr-9 text-left text-sm leading-5 whitespace-normal break-words outline-none transition-colors focus:bg-[#dcedee] focus:text-[#10303d] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-semibold data-[state=checked]:text-[#1f6f7a]',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-3 flex size-4 items-center justify-center text-[#1f6f7a]">
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden="true" className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export function SelectLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        'px-3 py-2 font-mono text-[10px] font-medium tracking-[0.06em] text-[#718087] uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn('mx-1 my-1 h-px bg-[#e3dfd6]', className)}
      {...props}
    />
  );
}
