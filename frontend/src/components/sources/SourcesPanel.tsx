import { PanelRightClose, Quote, ShieldCheck } from "lucide-react";

import { SourceCitationCard } from "@/components/sources/SourceCitationCard";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/types/api";

export function SourcesPanel({ citations, onClose, embedded = false }: { citations: Citation[]; onClose?: () => void; embedded?: boolean }) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#f8f9fa]" aria-label="Answer sources">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b px-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidence</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Sources</h2>
            {citations.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-200 px-1 text-[9px] font-semibold text-slate-600">{citations.length}</span>}
          </div>
        </div>
        {onClose && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close sources"><PanelRightClose className="h-4 w-4" /></Button>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {citations.length ? (
          <div className="p-3">
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-[10px] leading-4 text-blue-800">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>This answer was grounded in {citations.length} passage{citations.length === 1 ? "" : "s"}. Open a card to inspect the full excerpt.</span>
            </div>
            <div className="space-y-2.5">
              {citations.map((citation, index) => <SourceCitationCard key={`${citation.chunk_id}-${index}`} citation={citation} index={index} />)}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-7 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl border bg-white text-slate-400 shadow-sm"><Quote className="h-5 w-5" /></div>
            <p className="mt-4 text-xs font-medium text-slate-700">No sources selected</p>
            <p className="mt-2 max-w-[220px] text-[10px] leading-5 text-muted-foreground">Ask a question, then open any response’s source count to review the supporting passages.</p>
          </div>
        )}
      </div>
      {!embedded && (
        <div className="shrink-0 border-t px-4 py-3 text-[9px] leading-4 text-muted-foreground">
          Source relevance indicates retrieval similarity, not independent verification.
        </div>
      )}
    </aside>
  );
}
