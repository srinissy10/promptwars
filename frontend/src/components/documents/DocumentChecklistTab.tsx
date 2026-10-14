import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Calendar, CheckSquare, Clock, FileCheck, GraduationCap, ListChecks, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { displayDocumentName } from "@/lib/utils";
import type { Document, ScholarshipChecklist } from "@/types/api";

export function DocumentChecklistTab({ document }: { document: Document }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  const checklistQuery = useQuery({
    queryKey: ["document-checklist", document.id],
    queryFn: () => api.extractChecklist(document.id),
    staleTime: 5 * 60_000,
    enabled: document.status === "ready",
  });

  const extractMutation = useMutation({
    mutationFn: () => api.extractChecklist(document.id),
    onSuccess: (data) => {
      queryClient.setQueryData(["document-checklist", document.id], data);
      toast.success("Scholarship checklist extracted");
    },
    onError: (err: unknown) => {
      toast.error("Failed to extract checklist", { description: String(err) });
    },
  });

  const checklist: ScholarshipChecklist | undefined = checklistQuery.data;

  function toggleItem(id: string) {
    setCompletedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const completedCount = Object.values(completedItems).filter(Boolean).length;
  const totalDocsCount = checklist?.required_documents?.length ?? 0;
  const progressPct = totalDocsCount > 0 ? Math.round((completedCount / totalDocsCount) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Scholarship & Requirements Checklist</h2>
                {checklist && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {checklist.provider === "openai" ? "AI Verified" : "Extractive Grounded"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {checklist?.title || `Requirement audit for ${displayDocumentName(document.filename)}`}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={extractMutation.isPending || document.status !== "ready"}
            onClick={() => extractMutation.mutate()}
          >
            {extractMutation.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {checklist ? "Re-analyze Checklist" : "Extract Requirements"}
          </Button>
        </div>

        {checklistQuery.isLoading || extractMutation.isPending ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border bg-white p-8 text-center text-muted-foreground shadow-sm">
            <LoaderCircle className="h-6 w-6 animate-spin text-amber-600" />
            <p className="text-sm font-medium text-slate-800">Scanning document for scholarship requirements...</p>
            <p className="text-xs text-slate-400">Extracting eligibility criteria, required documents, deadlines, and deliverables without hallucination.</p>
          </div>
        ) : checklist ? (
          <>
            {/* Progress Bar (if documents exist) */}
            {totalDocsCount > 0 && (
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="h-4 w-4 text-emerald-600" /> Application Document Progress
                  </span>
                  <span>{completedCount} of {totalDocsCount} gathered ({progressPct}%)</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Application Deadlines Banner */}
            {checklist.application_deadlines && checklist.application_deadlines.length > 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-900 mb-2">
                  <Calendar className="h-4 w-4 text-red-600" /> Critical Deadlines
                </div>
                <div className="space-y-1.5">
                  {checklist.application_deadlines.map((dl, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-red-900">
                      <span className="font-semibold">{dl.deadline_type || "Submission Deadline"}:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-red-200 font-bold">
                        {dl.date_or_description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Documents Checklist */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <FileCheck className="h-4 w-4 text-blue-600" /> Required Application Documents
                </div>
                <span className="text-[11px] text-muted-foreground">Check off items as you prepare them</span>
              </div>

              {checklist.required_documents && checklist.required_documents.length > 0 ? (
                <div className="divide-y rounded-lg border">
                  {checklist.required_documents.map((doc, idx) => {
                    const itemId = `doc-${idx}`;
                    const isChecked = Boolean(completedItems[itemId]);
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer select-none ${
                          isChecked ? "bg-emerald-50/40 text-slate-500" : "hover:bg-slate-50/70"
                        }`}
                        onClick={() => toggleItem(itemId)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(itemId)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${isChecked ? "line-through text-slate-400" : "text-slate-800"}`}>
                              {doc.document_name}
                            </span>
                            {doc.mandatory && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[9px] font-semibold text-rose-700 border border-rose-100">
                                Required
                              </span>
                            )}
                          </div>
                          {doc.source_page && (
                            <span className="text-[10px] text-muted-foreground mt-0.5 block">
                              Referenced on Page {doc.source_page}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No specific required documents listed in document text.</p>
              )}
            </div>

            {/* Eligibility Criteria */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <CheckSquare className="h-4 w-4 text-emerald-600" /> Eligibility Criteria
              </div>
              {checklist.eligibility_criteria && checklist.eligibility_criteria.length > 0 ? (
                <div className="space-y-2">
                  {checklist.eligibility_criteria.map((crit, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 rounded-lg border bg-slate-50/60 p-3 text-xs text-slate-800">
                      <span className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="flex-1">
                        <p className="leading-relaxed">{crit.criterion}</p>
                        {crit.source_page && (
                          <span className="text-[10px] text-muted-foreground mt-1 inline-block">Page {crit.source_page}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No explicit eligibility criteria found in extracted text.</p>
              )}
            </div>

            {/* Deliverables & Conditions Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Deliverables */}
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <Clock className="h-4 w-4 text-violet-600" /> Deliverables & Milestones
                </div>
                {checklist.deliverables && checklist.deliverables.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {checklist.deliverables.map((deliv, idx) => (
                      <li key={idx} className="rounded border bg-slate-50 p-2.5">
                        <span className="font-semibold block">{deliv.deliverable}</span>
                        {deliv.details && <span className="text-[11px] text-muted-foreground mt-0.5 block">{deliv.details}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No post-award deliverables specified.</p>
                )}
              </div>

              {/* Conditions */}
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Important Conditions & Clauses
                </div>
                {checklist.important_conditions && checklist.important_conditions.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {checklist.important_conditions.map((cond, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{cond}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No special conditions recorded.</p>
                )}
              </div>
            </div>

            {/* Source References */}
            {checklist.source_references && checklist.source_references.length > 0 && (
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <BookOpen className="h-4 w-4 text-slate-600" /> Source Citations
                </div>
                <div className="space-y-2">
                  {checklist.source_references.map((ref, idx) => (
                    <div key={idx} className="rounded-lg border bg-slate-50/60 p-3 text-xs text-slate-700">
                      <div className="font-semibold text-slate-800 mb-0.5">Page {ref.page_number}</div>
                      <p className="italic text-slate-600">"{ref.snippet}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border bg-white p-8 text-center text-muted-foreground shadow-sm">
            <GraduationCap className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No scholarship checklist generated yet.</p>
            <p className="text-xs max-w-sm">Click "Extract Requirements" above to scan for required documents, deadlines, and eligibility criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
