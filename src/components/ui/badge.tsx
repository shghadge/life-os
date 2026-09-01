import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium transition-colors border select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-border/60 bg-secondary/80 text-secondary-foreground",
        destructive:
          "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
        outline: "text-foreground border-border",
        subtle: "border-border/40 bg-muted/60 text-muted-foreground",
        // Semantic quiet status styles
        wishlist: "border-neutral-500/20 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
        applied: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
        screening: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
        interviewing: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        offer: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold",
        rejected: "border-neutral-500/20 bg-neutral-500/10 text-neutral-500 line-through decoration-neutral-400/50",
        archived: "border-neutral-500/20 bg-neutral-500/5 text-neutral-400",
        // Priority
        priorityHigh: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
        priorityMedium: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        priorityLow: "border-neutral-500/20 bg-neutral-500/10 text-neutral-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
