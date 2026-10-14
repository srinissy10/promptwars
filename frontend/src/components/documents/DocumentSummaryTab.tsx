import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Calendar, CheckCircle2, FileText, LoaderCircle, RefreshCw, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { displayDocumentName } from "@/lib/utils";
import type { Document } from "@/types/api";

export function DocumentSummaryTab({ document }: { document: Document }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["document-summary", document.id],
    queryFn: () => api.summarizeDocument(document.id),
    staleTime: 5 * 60_000,
    enabled: document.status === "ready",
  });

  const summarizeMutation = useMutation({
    mutationFn: () => api.summarizeDocument(document.id),
    onSuccess: (data) => {
      queryClient.setQueryData(["document-summary", document.id], data);
      toast.success("Executive summary updated");
    },
    onError: (err: unknown) => {
      toast.error("Failed to generate summary", { description: String(err) });
    },
  });

  const summary = summaryQuery.data;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">AI Document Summary</h2>
              {summary && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  summary.provider === "openai" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {summary.provider === "openai" ? "AI Generated" : "Extractive Grounded"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Structured executive takeaways for {displayDocumentName(document.filename)}
            </p>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs shrink-0"
            disabled={summarizeMutation.isPending || document.status !== "ready"}
            onClick={() => summarizeMutation.mutate()}
          >
            {summarizeMutation.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {summary ? "Refresh Summary" : "Generate Summary"}
          </Button>
        </div>

        {summaryQuery.isLoading || summarizeMutation.isPending ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border bg-white p-8 text-center text-muted-foreground shadow-sm">
            <LoaderCircle className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Analyzing document and generating executive summary...</p>
            <p className="text-xs text-slate-400">Extracting key points, dates, and organizational entities.</p>
          </div>
        ) : summary ? (
          <>
            {/* Executive Summary Card */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <Sparkles className="h-4 w-4 text-blue-600" /> Executive Summary
              </div>
              <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line bg-slate-50/70 p-4 rounded-lg border border-slate-100">
                {summary.executive_summary}
              </p>
            </div>

            {/* Key Points */}
            {summary.key_points && summary.key_points.length > 0 && (
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Key Insights & Takeaways
                </div>
                <ul className="space-y-2">
                  {summary.key_points.map((point, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-xs text-slate-700 leading-normal">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dates & Entities Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Important Dates */}
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <Calendar className="h-4 w-4 text-violet-600" /> Important Dates & Deadlines
                </div>
                {summary.important_dates && summary.important_dates.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {summary.important_dates.map((date, index) => (
                      <span key={index} className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 border border-violet-100">
                        <Calendar className="h-3 w-3" /> {date}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No explicit dates detected in document text.</p>
                )}
              </div>

              {/* Key Entities */}
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <Tag className="h-4 w-4 text-amber-600" /> Key Entities & Programs
                </div>
                {summary.key_entities && summary.key_entities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.key_entities.map((entity, index) => (
                      <span key={index} className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-100">
                        {entity}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No key entities detected.</p>
                )}
              </div>
            </div>

            {/* Source References */}
            {summary.source_references && summary.source_references.length > 0 && (
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <BookOpen className="h-4 w-4 text-slate-600" /> Supporting Evidence Passages
                </div>
                <div className="space-y-2">
                  {summary.source_references.map((ref, idx) => (
                    <div key={idx} className="rounded-lg border bg-slate-50/60 p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                        <span>Page {ref.page_number}</span>
                        {ref.section_title && <span className="text-[10px] text-muted-foreground font-normal">{ref.section_title}</span>}
                      </div>
                      <p className="text-slate-600 italic">"{ref.snippet}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border bg-white p-8 text-center text-muted-foreground shadow-sm">
            <FileText className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No summary generated yet.</p>
            <p className="text-xs max-w-sm">Click "Generate Summary" above to extract an executive summary and key insights.</p>
          </div>
        )}
      </div>
    </div>
  );
}
