import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Liquid glass button styling with gradient overlays via pseudo-elements
// Light mode: uses dark tints for visibility on light backgrounds
// Dark mode: uses white tints for the glass effect
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 before:absolute before:inset-0 before:rounded-lg before:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:pointer-events-none before:bg-gradient-to-br before:from-black/10 before:via-transparent before:to-transparent before:opacity-70 after:bg-gradient-to-tl after:from-black/5 after:via-transparent after:to-transparent after:opacity-50 dark:before:from-white/60 dark:before:via-transparent dark:before:to-transparent dark:after:from-white/30 dark:after:via-transparent dark:after:to-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-black/[0.03] border border-black/20 backdrop-blur-sm shadow-[inset_0_1px_0px_rgba(255,255,255,0.75),0_0_9px_rgba(0,0,0,0.08),0_3px_8px_rgba(0,0,0,0.1)] hover:bg-black/[0.08] text-gray-800 dark:bg-white/[0.025] dark:border-white/50 dark:shadow-[inset_0_1px_0px_rgba(255,255,255,0.75),0_0_9px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.15)] dark:hover:bg-white/30 dark:text-white",
        destructive:
          "bg-red-500/10 border border-red-500/30 backdrop-blur-sm shadow-[inset_0_1px_0px_rgba(255,255,255,0.75),0_0_9px_rgba(0,0,0,0.08),0_3px_8px_rgba(0,0,0,0.1)] hover:bg-red-500/20 text-red-700 dark:bg-red-500/20 dark:border-red-500/50 dark:shadow-[inset_0_1px_0px_rgba(255,255,255,0.75),0_0_9px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.15)] dark:hover:bg-red-500/30 dark:text-red-300",
        outline:
          "bg-transparent border border-black/20 backdrop-blur-sm shadow-[inset_0_1px_0px_rgba(255,255,255,0.5),0_0_6px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.08)] hover:bg-black/[0.05] text-gray-800 dark:border-white/30 dark:shadow-[inset_0_1px_0px_rgba(255,255,255,0.5),0_0_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.1)] dark:hover:bg-white/20 dark:text-white",
        secondary:
          "bg-black/[0.05] border border-black/15 backdrop-blur-sm shadow-[inset_0_1px_0px_rgba(255,255,255,0.6),0_0_6px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.1)] hover:bg-black/[0.1] text-gray-800 dark:bg-white/10 dark:border-white/40 dark:shadow-[inset_0_1px_0px_rgba(255,255,255,0.6),0_0_6px_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.12)] dark:hover:bg-white/25 dark:text-white",
        ghost:
          "bg-transparent border border-transparent hover:bg-black/[0.05] text-gray-800 dark:hover:bg-white/10 dark:text-white before:opacity-0 after:opacity-0",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
