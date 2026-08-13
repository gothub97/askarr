import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The *arr button: a 1px border, 4px corners, and a fill in the kind's colour.
 *
 * Askarr used to carry primary actions as outline ink on the theory that a
 * console should stay flat. The family it belongs to does the opposite — its
 * buttons are solid, and the colour is how you tell an approve from a delete
 * at a glance in a table of forty rows. The fill won.
 *
 * `variant` keeps shadcn's names so existing call sites still type-check;
 * `default` is the primary action.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding leading-none whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-65 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "border-primary-fill bg-primary-fill text-primary-foreground hover:border-[color-mix(in_srgb,var(--primary-fill),black_12%)] hover:bg-[color-mix(in_srgb,var(--primary-fill),black_12%)]",
        // The family's neutral button: a panel-coloured block, not a ghost.
        outline:
          "border-border-strong bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "border-border-strong bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary),var(--foreground)_10%)]",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:border-[color-mix(in_srgb,var(--destructive),black_12%)] hover:bg-[color-mix(in_srgb,var(--destructive),black_12%)]",
        success:
          "border-positive bg-positive text-positive-foreground hover:border-[color-mix(in_srgb,var(--positive),black_12%)] hover:bg-[color-mix(in_srgb,var(--positive),black_12%)]",
        warning:
          "border-warning bg-warning text-warning-foreground hover:border-[color-mix(in_srgb,var(--warning),black_12%)] hover:bg-[color-mix(in_srgb,var(--warning),black_12%)]",
        link: "border-transparent text-primary underline-offset-2 hover:underline",
      },
      size: {
        // Padding straight from Radarr's Button.css.
        default: "gap-1.5 px-4 py-1.5 text-base",
        sm: "gap-1 px-[5px] py-px text-sm",
        lg: "gap-2 px-5 py-2.5 text-xl",
        icon: "size-7",
        "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-8 [&_svg:not([class*='size-'])]:size-4",
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

/**
 * Buttons welded into one control, the way the *arr toolbars do it: shared
 * edges, square inner corners, a single 1px line between neighbours.
 */
function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      className={cn(
        "inline-flex items-center [&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:hover]:relative [&>*:focus-visible]:relative",
        className
      )}
      {...props}
    />
  )
}

export { Button, ButtonGroup, buttonVariants }
