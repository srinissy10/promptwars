import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/types/api";

const labels: Record<DocumentStatus, string> = {
  ready: "Ready",
  processing: "Processing",
  failed: "Failed",
};

export function DocumentStatusBadge({ status, compact = false }: { status: DocumentStatus; compact?: boolean }) {
  const Icon = status === "ready" ? CheckCircle2 : status === "processing" ? LoaderCircle : AlertTriangle;
  return (
    <Badge variant={status === "ready" ? "success" : status === "processing" ? "warning" : "destructive"} className={compact ? "gap-1 border-0 px-1.5 py-0 text-[9px]" : "gap-1.5 border-0 px-2.5 py-1"}>
      <Icon className={status === "processing" ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
      {labels[status]}
    </Badge>
  );
}
