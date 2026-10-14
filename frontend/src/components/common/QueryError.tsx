import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

export function QueryError({ error, onRetry, compact = false }: { error: unknown; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-lg border border-red-100 bg-red-50/70 p-3" : "mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center"} role="alert">
      <AlertCircle className={compact ? "mb-2 h-4 w-4 text-red-600" : "mb-4 h-8 w-8 text-red-600"} />
      <p className="text-sm font-medium text-foreground">Couldn’t load this content</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{getErrorMessage(error)}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}
