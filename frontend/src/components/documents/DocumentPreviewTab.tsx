import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Eye, FileText, Hash, Layers, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { displayDocumentName, formatFileSize } from "@/lib/utils";
import type { Document } from "@/types/api";

export function DocumentPreviewTab({ document }: { document: Document }) {
  const { api } = useAuth();

  const previewQuery = useQuery({
    queryKey: ["document-preview", document.id],
    queryFn: () => api.previewDocument(document.id),
    staleTime: 60_000,
  });

  const preview = previewQuery.data;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header card */}
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{displayDocumentName(document.filename)}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  v{document.current_version || 1}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {document.extension.toUpperCase().slice(1)} File · {formatFileSize(document.size_bytes)} · {document.page_count} pages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={api.getDownloadUrl(document.id)} download={document.filename}>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </a>
            <a href={api.getFileUrl(document.id)} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="h-9 gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Open Full File
              </Button>
            </a>
          </div>
        </div>

        {/* Metadata stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-white p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Layers className="h-4 w-4 text-blue-500" /> Pages
            </div>
            <p className="mt-1.5 text-lg font-bold text-slate-900">{document.page_count}</p>
          </div>
          <div className="rounded-lg border bg-white p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Hash className="h-4 w-4 text-emerald-500" /> Search Chunks
            </div>
            <p className="mt-1.5 text-lg font-bold text-slate-900">{document.chunk_count}</p>
          </div>
          <div className="rounded-lg border bg-white p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <FileText className="h-4 w-4 text-violet-500" /> File Size
            </div>
            <p className="mt-1.5 text-lg font-bold text-slate-900">{formatFileSize(document.size_bytes)}</p>
          </div>
          <div className="rounded-lg border bg-white p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Eye className="h-4 w-4 text-amber-500" /> Version
            </div>
            <p className="mt-1.5 text-lg font-bold text-slate-900">v{document.current_version || 1}</p>
          </div>
        </div>

        {/* Snippet preview */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-5 py-3.5 flex items-center justify-between bg-slate-50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">Extracted Page Preview</h3>
            <span className="text-[11px] text-muted-foreground">Showing extracted text passages</span>
          </div>

          {previewQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" /> Loading preview...
            </div>
          ) : preview && preview.preview_pages.length > 0 ? (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {preview.preview_pages.map((page) => (
                <div key={page.page_number} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Page {page.page_number}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">{page.section_title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-line font-mono bg-slate-50 p-3 rounded border">
                    {page.snippet}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No preview text extracted yet. Ensure the document is in ready status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
