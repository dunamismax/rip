import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/12 text-primary shadow-sm',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        success: 'border-emerald-200 bg-emerald-100/80 text-emerald-700',
        warning: 'border-amber-200 bg-amber-100/80 text-amber-700',
        destructive: 'border-rose-200 bg-rose-100/80 text-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
