import { FilePlus2, Search, X } from "lucide-react";

import { LoadingState } from "@/components/common/LoadingState";
import { QueryError } from "@/components/common/QueryError";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { Upload } from "@/components/documents/Upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Document } from "@/types/api";

interface DocumentListProps {
  documents: Document[];
  selectedId: string | null;
  search: string;
  loading: boolean;
  error: unknown;
  allowedExtensions: string[];
  maxFileMb: number;
  uploadProgress: number | null;
  uploading: boolean;
  onSearch: (value: string) => void;
  onSelect: (documentId: string) => void;
  onUpload: (file: File) => void;
  onRetry: () => void;
}

export function DocumentList(props: DocumentListProps) {
  const { documents, selectedId, search, loading, error } = props;
  return (
    <div className="bg-[#f8f9fa]">
      <div className="px-4 pb-3 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Knowledge library</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Documents</h2>
          </div>
          <Button size="icon" className="h-8 w-8" onClick={() => document.getElementById("sidebar-file-trigger")?.click()} aria-label="Upload a document">
            <FilePlus2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Upload inputId="sidebar-file-trigger" allowedExtensions={props.allowedExtensions} maxFileMb={props.maxFileMb} progress={props.uploadProgress} uploading={props.uploading} onUpload={props.onUpload} compact />
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => props.onSearch(event.target.value)} className="h-8 bg-white pl-9 pr-8 text-xs shadow-none" placeholder="Search documents" aria-label="Search documents" />
          {search && <button type="button" className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted" onClick={() => props.onSearch("")} aria-label="Clear search"><X className="h-3 w-3" /></button>}
        </div>
      </div>

      <div className="px-2 pb-3">
        {loading ? <LoadingState rows={5} /> : error ? <QueryError compact error={error} onRetry={props.onRetry} /> : documents.length ? (
          <div className="space-y-0.5">
            {documents.map((item) => <DocumentCard key={item.id} document={item} selected={selectedId === item.id} onSelect={() => props.onSelect(item.id)} />)}
          </div>
        ) : (
          <div className="mx-3 mt-8 rounded-lg border border-dashed bg-white/60 px-4 py-8 text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground"><FilePlus2 className="h-4 w-4" /></div>
            <p className="mt-3 text-xs font-medium">{search ? "No matching documents" : "Your library is empty"}</p>
            <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{search ? "Try a different filename." : "Upload a PDF, DOCX, or TXT file to begin."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
