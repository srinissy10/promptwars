import { ArrowUp, LoaderCircle, Lock, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentStatus } from "@/types/api";

export function Composer({ documentStatus, busy, draftPrompt, onSend }: { documentStatus: DocumentStatus | null; busy: boolean; draftPrompt: string | null; onSend: (message: string) => void }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ready = documentStatus === "ready";

  useEffect(() => {
    if (!draftPrompt) return;
    setValue(draftPrompt);
    textareaRef.current?.focus();
  }, [draftPrompt]);

  function submit() {
    const message = value.trim();
    if (!message || !ready || busy) return;
    setValue("");
    onSend(message);
  }

  const note = !documentStatus ? "Select a document first" : documentStatus === "processing" ? "Available after processing" : documentStatus === "failed" ? "Reindex the document to continue" : "Enter to send · Shift + Enter for a new line";

  return (
    <footer className="shrink-0 border-t bg-white px-3 pb-3 pt-3 sm:px-6 sm:pb-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,.07)] transition-shadow focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <Textarea
            ref={textareaRef}
            rows={1}
            maxLength={4000}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={!ready || busy}
            placeholder={ready ? "Ask a question about this document…" : note}
            className="max-h-36 min-h-[42px] resize-none border-0 px-2 py-2.5 text-[13px] leading-5 shadow-none focus-visible:ring-0 disabled:bg-white"
            style={{ height: "auto" }}
          />
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              {!ready && <Lock className="h-3 w-3" />}
              <span>{note}</span>
            </div>
            <div className="flex items-center gap-2">
              {value.length > 3500 && <span className="text-[9px] text-muted-foreground">{value.length}/4000</span>}
              <Button variant="ghost" size="icon" className="hidden h-8 w-8 text-muted-foreground" disabled aria-label="Attach a file"><Paperclip /></Button>
              <Button size="icon" className="h-8 w-8 rounded-lg" disabled={!ready || busy || !value.trim()} onClick={submit} aria-label="Send message">
                {busy ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[8px] text-muted-foreground/80">Answers are generated from retrieved passages. Verify critical information against the cited source.</p>
      </div>
    </footer>
  );
}
