import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 outline-none select-none active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-2xs hover:bg-destructive/90 focus-visible:ring-destructive/30',
        outline:
          'border border-border/90 bg-card text-foreground shadow-2xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
        link: 'h-auto px-0 text-foreground underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-8 px-3 has-[>svg]:px-2.5',
        sm: 'h-7 gap-1 px-2.5 text-xs has-[>svg]:px-2',
        lg: 'h-10 px-4 text-sm has-[>svg]:px-3.5',
        icon: 'size-8',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

 
export { Button, buttonVariants }
