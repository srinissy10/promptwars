import { BookOpen, CheckCircle2, Clock, FileArchive, FileText, GraduationCap, HardDrive, Layers, Sparkles, UploadCloud } from "lucide-react";

import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { displayDocumentName, formatFileSize, formatRelativeTime } from "@/lib/utils";
import type { Document } from "@/types/api";

interface DashboardViewProps {
  documents: Document[];
  onSelectDocument: (id: string) => void;
  onOpenUpload: () => void;
  onNavigateTab: (tab: "chat" | "summary" | "checklist" | "versions" | "compress") => void;
}

export function DashboardView({ documents, onSelectDocument, onOpenUpload, onNavigateTab }: DashboardViewProps) {
  const readyDocs = documents.filter((d) => d.status === "ready");
  const totalPages = documents.reduce((acc, d) => acc + (d.page_count || 0), 0);
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
  const totalBytes = documents.reduce((acc, d) => acc + (d.size_bytes || 0), 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 p-6 sm:p-8 text-white shadow-sm">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" /> MINDMATE Intelligence Workspace
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
              Your Personal Knowledge Partner.
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-blue-100 leading-relaxed">
              Transform PDFs, DOCX, and text notes into searchable evidence, instant executive summaries, verified checklists, and grounded answers.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button size="sm" className="bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs h-9 gap-2 shadow-sm" onClick={onOpenUpload}>
                <UploadCloud className="h-4 w-4 text-blue-600" /> Upload Document
              </Button>
              {documents.length > 0 && (
                <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs h-9 gap-2" onClick={() => onSelectDocument(documents[0].id)}>
                  <BookOpen className="h-4 w-4" /> Open Latest Document
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Quick Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <FileText className="h-4 w-4 text-blue-600" /> Documents
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{documents.length}</p>
            <p className="text-[10px] text-emerald-600 font-medium mt-1">{readyDocs.length} ready for chat</p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Layers className="h-4 w-4 text-violet-600" /> Total Pages
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{totalPages}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Parsed & indexed</p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Search Chunks
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{totalChunks}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Evidence embeddings</p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <HardDrive className="h-4 w-4 text-amber-600" /> Total Storage
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatFileSize(totalBytes)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Local isolated files</p>
          </div>
        </div>

        {/* Feature quick tools */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div
            className="rounded-xl border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition cursor-pointer"
            onClick={() => {
              if (documents.length > 0) {
                onSelectDocument(documents[0].id);
                onNavigateTab("summary");
              } else {
                onOpenUpload();
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">AI Document Summary</h3>
                <p className="text-[11px] text-muted-foreground">Extract executive takeaways</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Instant multi-point summaries, deadlines, and key organizational entities with verified citations.
            </p>
          </div>

          <div
            className="rounded-xl border bg-white p-5 shadow-sm hover:border-amber-300 hover:shadow-md transition cursor-pointer"
            onClick={() => {
              if (documents.length > 0) {
                onSelectDocument(documents[0].id);
                onNavigateTab("checklist");
              } else {
                onOpenUpload();
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Scholarship Checklist</h3>
                <p className="text-[11px] text-muted-foreground">Audit required documents</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Interactive document checklists, eligibility filters, and strict deadline extractions without hallucinations.
            </p>
          </div>

          <div
            className="rounded-xl border bg-white p-5 shadow-sm hover:border-violet-300 hover:shadow-md transition cursor-pointer"
            onClick={() => {
              if (documents.length > 0) {
                onSelectDocument(documents[0].id);
                onNavigateTab("compress");
              } else {
                onOpenUpload();
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50 text-violet-600">
                <FileArchive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">PDF Compression</h3>
                <p className="text-[11px] text-muted-foreground">Verified size reduction</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Stream-compress PDF files with verified output integrity, page verification, and transparent byte savings.
            </p>
          </div>
        </div>

        {/* Recent Documents Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-5 py-4 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Document Repository</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Click any document to inspect and analyze</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">{documents.length} Total</span>
          </div>

          {documents.length > 0 ? (
            <div className="divide-y">
              {documents.slice(0, 8).map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 sm:px-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer"
                  onClick={() => onSelectDocument(doc.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-slate-50 text-slate-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-900 truncate max-w-[260px] sm:max-w-md">
                          {displayDocumentName(doc.filename)}
                        </p>
                        <DocumentStatusBadge status={doc.status} />
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">
                          v{doc.current_version || 1}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatFileSize(doc.size_bytes)} · {doc.page_count} pages · {doc.chunk_count} passages
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {formatRelativeTime(doc.created_at)}
                    </span>
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-blue-600 hover:text-blue-700">
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Your document repository is empty</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Upload your PDFs, Word documents, or notes to get started with MINDMATE.
              </p>
              <Button size="sm" className="mt-4 gap-2 text-xs" onClick={onOpenUpload}>
                <UploadCloud className="h-4 w-4" /> Upload First Document
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
