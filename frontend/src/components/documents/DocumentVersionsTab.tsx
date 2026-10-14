import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, FileCode, History, LoaderCircle, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { displayDocumentName, formatFileSize, formatRelativeTime } from "@/lib/utils";
import type { Document } from "@/types/api";

export function DocumentVersionsTab({ document }: { document: Document }) {
  const { api, settings } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);

  const versionsQuery = useQuery({
    queryKey: ["document-versions", document.id],
    queryFn: () => api.listVersions(document.id),
  });

  const replaceMutation = useMutation({
    mutationFn: (file: File) => api.replaceDocument(document.id, file, setReplaceProgress),
    onMutate: () => setReplaceProgress(0),
    onSuccess: async (updatedDoc) => {
      queryClient.setQueryData(["document", document.id], updatedDoc);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["document-versions", document.id] }),
        queryClient.invalidateQueries({ queryKey: ["document-preview", document.id] }),
        queryClient.invalidateQueries({ queryKey: ["document-summary", document.id] }),
        queryClient.invalidateQueries({ queryKey: ["conversations", document.id] }),
      ]);
      toast.success(`Updated to Version ${updatedDoc.current_version || 2}`, {
        description: "Vector chunks and search representations re-indexed cleanly.",
      });
    },
    onError: (err: unknown) => {
      toast.error("Replacement failed", {
        description: String(err) + " — Previous working version preserved.",
      });
    },
    onSettled: () => setReplaceProgress(null),
  });

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!settings.allowed_extensions.map((ext) => ext.toLowerCase()).includes(extension)) {
      toast.error("Unsupported file type", {
        description: `Supported formats: ${settings.allowed_extensions.join(", ")}.`,
      });
      return;
    }

    if (file.size > settings.max_file_mb * 1024 * 1024) {
      toast.error("File exceeds limit", {
        description: `Maximum file size allowed is ${settings.max_file_mb} MB.`,
      });
      return;
    }

    replaceMutation.mutate(file);
    // Reset file input so user can re-select same file if needed
    e.target.value = "";
  }

  const versions = versionsQuery.data || [];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Replace Header */}
        <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Document Version History</h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Current: v{document.current_version || 1}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track file modifications, content hashes, and replace with updated revisions.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={settings?.allowed_extensions.join(",")}
              onChange={handleFileSelected}
            />
            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white"
              disabled={replaceMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {replaceMutation.isPending ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Replacing... {replaceProgress !== null ? `${replaceProgress}%` : ""}
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" /> Replace Document File
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Informational callout */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
          <History className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <span>
            Replacing a document preserves the Document ID and conversation threads, while atomically replacing the search index so old superseded chunks never contaminate new answers. If a replacement file fails parsing, your current working version remains intact.
          </span>
        </div>

        {/* Timeline / Version Cards */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-5 py-3.5 flex items-center justify-between bg-slate-50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">Revisions Log</h3>
            <span className="text-[11px] text-muted-foreground">{versions.length} recorded version{versions.length === 1 ? "" : "s"}</span>
          </div>

          {versionsQuery.isLoading ? (
            <div className="flex h-36 items-center justify-center gap-2 text-muted-foreground text-xs">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading versions history...
            </div>
          ) : versions.length > 0 ? (
            <div className="divide-y">
              {versions.map((ver) => {
                const isCurrent = ver.version_number === (document.current_version || 1);
                return (
                  <div key={ver.id} className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isCurrent ? "bg-blue-50/20" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-bold text-xs ${
                        isCurrent ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 text-slate-600"
                      }`}>
                        v{ver.version_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-900">{displayDocumentName(ver.filename)}</p>
                          {isCurrent && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatFileSize(ver.size_bytes)} · {ver.page_count} pages · {ver.chunk_count} passages
                        </p>
                        {ver.content_hash && (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono">
                            <FileCode className="h-3 w-3 text-slate-400" />
                            <span>SHA-256: {ver.content_hash.slice(0, 16)}…</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground self-end sm:self-center">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatRelativeTime(ver.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Initial version 1 registered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
