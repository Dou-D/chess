import * as React from "react";
import { cn } from "../../lib/utils";

export function Alert({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800",
        className,
      )}
      {...props}
    />
  );
}
