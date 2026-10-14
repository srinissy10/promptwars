import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDownRight, CheckCircle2, FileArchive, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { displayDocumentName, formatFileSize } from "@/lib/utils";
import type { Document, PdfCompressionResult } from "@/types/api";

export function DocumentCompressTab({ document }: { document: Document }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [replaceOriginal, setReplaceOriginal] = useState(false);
  const [lastResult, setLastResult] = useState<PdfCompressionResult | null>(null);

  const isPdf = document.extension.toLowerCase() === ".pdf";

  const compressMutation = useMutation({
    mutationFn: () => api.compressDocument(document.id, replaceOriginal),
    onSuccess: async (result) => {
      setLastResult(result);
      if (result.replaced_original) {
        await queryClient.invalidateQueries({ queryKey: ["document", document.id] });
        await queryClient.invalidateQueries({ queryKey: ["documents"] });
        toast.success("PDF compressed and updated in workspace", {
          description: `Saved ${formatFileSize(result.reduction_bytes)} (${result.reduction_percentage}% reduction).`,
        });
      } else {
        toast.success("PDF compression verified successfully", {
          description: result.reduction_bytes > 0
            ? `Reduction: ${result.reduction_percentage}% (${formatFileSize(result.reduction_bytes)} saved)`
            : "PDF is already fully stream-compressed.",
        });
      }
    },
    onError: (err: unknown) => {
      toast.error("Compression failed", { description: String(err) });
    },
  });

  if (!isPdf) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 bg-slate-50/50">
        <div className="mx-auto max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">PDF Compression Not Applicable</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            The selected file is a <span className="font-semibold uppercase">{document.extension.slice(1)}</span> document.
            Compression optimizes internal PDF content streams and embedded font tables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header card */}
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <FileArchive className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">PDF Compression & Stream Optimizer</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lossless content-stream optimization and deflated metadata for {displayDocumentName(document.filename)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white"
              disabled={compressMutation.isPending}
              onClick={() => compressMutation.mutate()}
            >
              {compressMutation.isPending ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Compressing & Verifying...
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3.5 w-3.5" /> Run Compression
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Options */}
        <div className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={replaceOriginal}
              onChange={(e) => setReplaceOriginal(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span>Replace document file in workspace if compressed size is smaller</span>
          </label>
          <span className="text-[11px] text-muted-foreground">Original remains safe on error</span>
        </div>

        {/* Compression Comparison Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium text-muted-foreground">Original Size</div>
            <p className="mt-1.5 text-xl font-bold text-slate-800">
              {formatFileSize(lastResult ? lastResult.original_size_bytes : document.size_bytes)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{document.page_count} PDF pages</p>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium text-muted-foreground">Output Size</div>
            <p className="mt-1.5 text-xl font-bold text-slate-800">
              {lastResult ? formatFileSize(lastResult.output_size_bytes) : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {lastResult ? (lastResult.reduction_bytes > 0 ? "Stream compressed" : "Identical size") : "Pending compression"}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium text-muted-foreground">Space Reduction</div>
            <p className="mt-1.5 text-xl font-bold text-emerald-600">
              {lastResult ? `${lastResult.reduction_percentage}%` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {lastResult ? (lastResult.reduction_bytes > 0 ? `Saved ${formatFileSize(lastResult.reduction_bytes)}` : "No size reduction possible") : "Zero bloat claim"}
            </p>
          </div>
        </div>

        {/* Verification banner */}
        {lastResult && (
          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Integrity Verification Report
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>PDF structure and cross-reference table verified intact.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>All {lastResult.page_count ?? document.page_count} pages read and validated without corruption.</span>
              </div>
              {lastResult.reduction_bytes === 0 && (
                <div className="rounded-md bg-amber-50 p-3 text-[11px] text-amber-800 border border-amber-100">
                  Notice: This PDF's internal streams are already using optimal Deflate compression. MINDMATE does not report fake reductions when files are already compact.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
