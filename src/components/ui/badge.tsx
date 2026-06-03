import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-xs font-medium text-[#9ca3af]",
        className,
      )}
      {...props}
    />
  );
}
