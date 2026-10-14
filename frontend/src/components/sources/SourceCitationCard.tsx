import { BookOpenText, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { citationMatchLevel, cn } from "@/lib/utils";
import type { Citation } from "@/types/api";

const matchStyles = {
  exact: "border-blue-100 bg-blue-50 text-blue-700",
  high: "border-emerald-100 bg-emerald-50 text-emerald-700",
  medium: "border-amber-100 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

export function SourceCitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const level = citationMatchLevel(citation) as keyof typeof matchStyles;
  const pageLabel = citation.page_end && citation.page_end !== citation.page_number ? `Pages ${citation.page_number}–${citation.page_end}` : `Page ${citation.page_number}`;

  return (
    <article className="overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)] transition-shadow hover:shadow-sm">
      <button type="button" className="w-full p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded bg-slate-950 text-[9px] font-semibold text-white">{index + 1}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{pageLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[8px] uppercase tracking-wide", matchStyles[level])}>{level} match</Badge>
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <BookOpenText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="line-clamp-1 text-[11px] font-medium text-slate-700">{citation.section_title || "Document passage"}</p>
        </div>
        <p className={cn("mt-2 text-[11px] leading-[1.65] text-slate-600", expanded ? "" : "line-clamp-4")}>{citation.snippet}</p>
        <div className="mt-3 flex items-center justify-between text-[8px] uppercase tracking-wide text-muted-foreground/80">
          <span>Chunk {citation.chunk_id.slice(0, 8)}</span>
          <span>{Math.round(Math.min(1, Math.max(0, citation.score)) * 100)}% relevance</span>
        </div>
      </button>
    </article>
  );
}
