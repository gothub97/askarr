import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-border-strong bg-input px-2 py-1.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-focus-field focus-visible:shadow-[0_0_6px_color-mix(in_srgb,var(--focus-field),transparent_40%)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-65 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
