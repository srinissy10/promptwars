import { FileUp, LoaderCircle, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatFileSize } from "@/lib/utils";

interface UploadProps {
  allowedExtensions: string[];
  maxFileMb: number;
  progress: number | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  compact?: boolean;
  inputId?: string;
}

export function Upload({ allowedExtensions, maxFileMb, progress, uploading, onUpload, compact = false, inputId }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queuedFile, setQueuedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!uploading && progress === null) setQueuedFile(null);
  }, [progress, uploading]);

  function chooseFile(file?: File) {
    if (!file) return;
    setQueuedFile(file);
    onUpload(file);
  }

  if (uploading && queuedFile) {
    return (
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/[0.07] text-primary"><LoaderCircle className="h-4 w-4 animate-spin" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{queuedFile.name}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{formatFileSize(queuedFile.size)} · Uploading {progress ?? 0}%</p>
          </div>
        </div>
        <Progress className="mt-3" value={progress ?? 0} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group rounded-lg border border-dashed border-slate-300 bg-white/70 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.025]",
        compact ? "p-3" : "p-4",
        dragging && "border-primary bg-primary/[0.04]",
      )}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
    >
      <input id={inputId} ref={inputRef} type="file" className="hidden" accept={allowedExtensions.join(",")} onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <button type="button" className="flex w-full items-center gap-3 text-left focus-visible:outline-none" onClick={() => inputRef.current?.click()}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {dragging ? <FileUp className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-700">Drop a file or browse</p>
          <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-muted-foreground">
            {allowedExtensions.map((value) => value.replace(".", "")).join(" · ")} · max {maxFileMb} MB
          </p>
        </div>
      </button>
      {queuedFile && !uploading && (
        <div className="mt-2 flex items-center justify-between rounded bg-muted px-2 py-1 text-[10px]">
          <span className="truncate">{queuedFile.name}</span>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setQueuedFile(null)}><X className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}
