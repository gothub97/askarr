import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge is the same square chip as `Label` in `@/components/status-label`,
 * kept because shadcn primitives expect it to exist. Reach for `Label` in new
 * code — it carries the `kind` vocabulary the rest of the app speaks.
 *
 * The pill shape is gone on purpose: in this family a chip is near-square, and
 * a rounded capsule reads as a different product.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-[5px] py-[2px] text-sm leading-none whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-primary-fill bg-primary-fill text-primary-foreground",
        secondary:
          "border-border-strong bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground",
        outline: "border-border-strong bg-transparent text-muted-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
        link: "border-transparent text-primary underline-offset-2 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
