import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-2", className)} aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg p-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-3", index % 2 === 0 ? "w-4/5" : "w-3/5")} />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading content</span>
    </div>
  );
}
