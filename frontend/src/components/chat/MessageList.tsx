import { AlertTriangle, FileSearch, FileText, MessagesSquare, RefreshCw, Sparkles } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { QueryError } from "@/components/common/QueryError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Citation, Document, Message } from "@/types/api";

interface MessageListProps {
  document: Document | null;
  messages: Message[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onPrompt: (prompt: string) => void;
  onShowSources: (citations: Citation[]) => void;
  onFeedback: (messageId: string, rating: -1 | 1) => void;
  onReindex: () => void;
}

const prompts = ["Summarize the key points", "What decisions or actions are required?", "List important dates and numbers"];

export function MessageList(props: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestMessage = props.messages.at(-1);
  const scrollSignal = `${props.messages.length}:${latestMessage?.id ?? ""}:${latestMessage?.content.length ?? 0}:${latestMessage?.streaming ?? false}`;

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: latestMessage?.streaming ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [latestMessage?.streaming, scrollSignal]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white" aria-live="polite">
      {!props.document ? (
        <EmptyWorkspace />
      ) : props.document.status === "processing" ? (
        <DocumentProcessing filename={props.document.filename} />
      ) : props.document.status === "failed" ? (
        <DocumentFailed message={props.document.error_message} onReindex={props.onReindex} />
      ) : props.loading ? (
        <MessageSkeleton />
      ) : props.error ? (
        <QueryError error={props.error} onRetry={props.onRetry} />
      ) : props.messages.length ? (
        <div className="divide-y divide-slate-100 pb-6">
          {props.messages.map((message) => (
            <MessageBubble key={message.id} message={message} onShowSources={() => props.onShowSources(message.citations)} onFeedback={(rating) => props.onFeedback(message.id, rating)} />
          ))}
        </div>
      ) : (
        <ReadyEmpty onPrompt={props.onPrompt} />
      )}
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-14 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border bg-slate-50 text-slate-500 shadow-sm"><FileSearch className="h-6 w-6" /></div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Grounded answers</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-900">Choose a document to start</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Select a file from your library or upload something new. DocChat will answer only from the selected document and show its evidence.</p>
      </div>
    </div>
  );
}

function DocumentProcessing({ filename }: { filename: string }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-14 text-center">
      <div className="max-w-sm">
        <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border bg-white text-primary shadow-sm">
          <FileText className="h-6 w-6" />
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-amber-400" />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">Preparing your document</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Extracting and indexing “{filename}”. This view refreshes automatically when it’s ready.</p>
        <div className="mx-auto mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/5 animate-[shimmer_1.6s_infinite] rounded-full bg-primary" /></div>
      </div>
    </div>
  );
}

function DocumentFailed({ message, onReindex }: { message: string | null; onReindex: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-14 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
        <h2 className="mt-4 text-lg font-semibold">Document processing failed</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{message || "DocChat couldn’t build the document index."}</p>
        <Button variant="outline" size="sm" className="mt-5" onClick={onReindex}><RefreshCw className="h-3.5 w-3.5" /> Retry indexing</Button>
      </div>
    </div>
  );
}

function ReadyEmpty({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/[0.07] text-primary"><Sparkles className="h-5 w-5" /></div>
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">What would you like to know?</h2>
        <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">Ask about details, compare sections, extract actions, or start with one of these prompts.</p>
        <div className="mt-6 grid gap-2 text-left sm:grid-cols-3">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onPrompt(prompt)} className="rounded-lg border bg-white p-3 text-[11px] leading-5 text-slate-600 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/[0.02] hover:text-slate-900">
              <MessagesSquare className="mb-2 h-3.5 w-3.5 text-primary" />{prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-7 px-6 py-8">
      {["right", "left", "right"].map((side, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className={side === "right" ? "h-3 w-2/3" : "h-3 w-4/5"} /><Skeleton className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}
