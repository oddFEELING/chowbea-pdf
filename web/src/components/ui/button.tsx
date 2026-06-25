import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Bold Blocks buttons: chunky ink outlines, uppercase Bricolage, hard offset
// shadows that the button "presses" into on click.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-[14px] border-2 border-ink font-heading font-extrabold uppercase tracking-wide outline-none transition-[transform,box-shadow,background-color] select-none focus-visible:ring-3 focus-visible:ring-amber/50 disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        // Primary action — ink panel sitting on an amber shadow.
        default:
          "bg-ink text-cream shadow-amber active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        // Secondary — outlined card, no shadow until you want to lift it.
        outline:
          "bg-card text-ink hover:bg-surface active:translate-x-px active:translate-y-px",
        // Pill-ish secondary with a small ink shadow.
        secondary:
          "bg-card text-ink shadow-block-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        ghost:
          "border-transparent text-ink hover:bg-surface active:translate-x-px active:translate-y-px",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground shadow-[4px_4px_0_var(--ink)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-[52px] px-6 text-base",
        icon: "size-11 px-0",
        "icon-sm": "size-9 rounded-xl px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
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
