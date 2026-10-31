import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-navy text-white hover:bg-navy-deep',
        outline:
          'border-line bg-white text-navy hover:bg-canvas hover:border-ink-muted/40 aria-expanded:bg-canvas',
        secondary: 'bg-surface text-navy hover:bg-line',
        ghost: 'text-navy hover:bg-surface aria-expanded:bg-surface',
        destructive:
          'border-status-rejected/30 bg-white text-status-rejected hover:bg-status-rejected-bg',
        link: 'text-teal underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 gap-2 px-4',
        xs: 'h-7 gap-1 rounded-md px-2 text-xs',
        sm: 'h-9 gap-1.5 px-3 text-[13px]',
        lg: 'h-11 gap-2 px-5',
        xl: 'h-12 gap-2 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-xs': 'size-7 rounded-md',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
