import { AlertTriangle, FileText, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";

import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayDocumentName, formatFileSize } from "@/lib/utils";
import type { ChatModel, Document } from "@/types/api";

interface ChatHeaderProps {
  document: Document | null;
  models: ChatModel[];
  selectedModel: string;
  deleting: boolean;
  reindexing: boolean;
  onModelChange: (value: string) => void;
  onDelete: () => void;
  onReindex: () => void;
}

export function ChatHeader({ document, models, selectedModel, deleting, reindexing, onModelChange, onDelete, onReindex }: ChatHeaderProps) {
  const selectedModelLabel = models.find((model) => model.id === selectedModel)?.label || selectedModel || "Model";
  const subtitle = !document
    ? "Select a document from the library to begin"
    : document.status === "ready"
      ? `${document.page_count} pages · ${document.chunk_count} searchable passages · ${formatFileSize(document.size_bytes)}`
      : document.status === "processing"
        ? "Extracting text and building the local search index…"
        : document.error_message || "Processing failed. Reindex the document or upload it again.";

  return (
    <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b bg-white px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg border bg-slate-50 text-slate-500 sm:grid"><FileText className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base" title={document?.filename}>
              {document ? displayDocumentName(document.filename) : "Document workspace"}
            </h1>
            {document && <DocumentStatusBadge status={document.status} />}
          </div>
          <p className="mt-1 max-w-[55vw] truncate text-[10px] text-muted-foreground lg:max-w-[44vw]">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Select value={selectedModel} onValueChange={onModelChange} disabled={models.length < 2}>
          <SelectTrigger className="h-9 w-[118px] border-slate-200 bg-white px-3 text-xs font-semibold leading-none text-slate-700 shadow-none sm:w-[132px]" aria-label={`Chat model: ${selectedModelLabel}`}>
            <SelectValue aria-label={selectedModelLabel}>{selectedModelLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[220px]">
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id} textValue={model.label || model.id}>
                <div>
                  <div className="text-[11px] font-semibold leading-4">{model.label || model.id}</div>
                  <div className="mt-0.5 text-[9px] leading-4 text-muted-foreground">
                    {model.id}{model.description ? ` · ${model.description}` : ""}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {document?.status === "failed" && (
          <Tooltip>
            <TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={onReindex} disabled={reindexing} aria-label="Reindex document">{reindexing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}</Button></TooltipTrigger>
            <TooltipContent>Reindex document</TooltipContent>
          </Tooltip>
        )}

        {document && (
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-destructive" aria-label="Delete document"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete document</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
                <AlertDialogTitle>Delete “{displayDocumentName(document.filename)}”?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes the local file, its search index, conversations, messages, citations, and feedback. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete document"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </header>
  );
}
