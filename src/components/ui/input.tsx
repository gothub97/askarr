import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // The field is a filled well, not an outlined transparent box: it sits
        // on --input, a value step up from the panel behind it. Focus is the
        // family's Bootstrap-lineage blue border plus a soft glow.
        "w-full min-w-0 rounded-md border border-border-strong bg-input px-2 py-1.5 text-base text-foreground transition-colors outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground placeholder:text-muted-foreground focus-visible:border-[#66afe9] focus-visible:shadow-[0_0_6px_rgba(102,175,233,0.6)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-65 aria-invalid:border-destructive aria-invalid:shadow-[0_0_6px_color-mix(in_srgb,var(--destructive),transparent_40%)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
