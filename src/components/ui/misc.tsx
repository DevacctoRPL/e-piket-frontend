/* Komponen kecil shadcn digabung: Separator, Skeleton, Badge, Switch, Tooltip, Popover, Alert. */
import * as React from 'react'
import {
  Popover as PopoverPrimitive,
  Separator as SeparatorPrimitive,
  Switch as SwitchPrimitive,
  Tooltip as TooltipPrimitive,
} from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border/80 bg-muted/50 text-foreground/85',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'border-border/90 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)
export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-2xs ring-0 transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[calc(100%)] data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md bg-foreground px-3 py-1.5 text-xs text-background ease-[var(--ease-out)] animate-in fade-in-0 zoom-in-[0.97] [--tw-duration:125ms]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-lg border border-border/90 bg-popover p-3 text-popover-foreground shadow-md shadow-black/5 outline-hidden ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-duration:120ms] data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.96] data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[state=open]:[--tw-duration:180ms]',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

const alertVariants = cva(
  // Callout netral: latar kartu, teks normal — warna hanya pada ikon (+ garis kiri tipis untuk tone kuat).
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border border-border/85 bg-card px-3.5 py-3 text-[13px] text-card-foreground shadow-2xs has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-2.5 [&>svg]:size-4 [&>svg]:translate-y-px',
  {
    variants: {
      variant: {
        default: '[&>svg]:text-muted-foreground',
        destructive: 'border-l-2 border-l-tone-danger [&>svg]:text-tone-danger',
        warning: 'border-l-2 border-l-tone-warning [&>svg]:text-tone-warning',
        info: '[&>svg]:text-tone-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)
export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
export function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('col-start-2 min-h-4 font-semibold tracking-tight', className)} {...props} />
  )
}
export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('col-start-2 grid justify-items-start gap-1 text-[13px] text-muted-foreground', className)}
      {...props}
    />
  )
}
