import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
}

function Progress({ value, className, ...props }: ProgressProps) {
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-primary/10", className)} {...props}>
      <div className="h-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export { Progress };
