"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies a value to the clipboard and says so, in the wording of the button. */
export function CopyButton({
  value,
  label = "Copy",
  copiedMessage = "Copied",
}: {
  value: string;
  label?: string;
  copiedMessage?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(copiedMessage);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is blocked outside a secure context; say what to do.
      toast.error("The browser blocked the clipboard. Select the text and copy it.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} aria-label={label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {label}
    </Button>
  );
}
