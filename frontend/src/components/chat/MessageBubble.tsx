import { Bot, Copy, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/api";

export function MessageBubble({ message, onShowSources, onFeedback }: { message: Message; onShowSources: () => void; onFeedback: (rating: -1 | 1) => void }) {
  const assistant = message.role === "assistant";
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  async function copyMessage() {
    await navigator.clipboard.writeText(message.content);
    toast.success("Copied to clipboard");
  }

  return (
    <article className={cn("group mx-auto flex w-full max-w-3xl gap-3 px-4 py-4 sm:gap-4 sm:px-6", assistant && "bg-slate-50/70")}>
      <div className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", assistant ? "bg-slate-950 text-white" : "border bg-white text-slate-600")}>
        {assistant ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-800">{assistant ? "DocChat" : "You"}</span>
          <span className="text-[9px] text-muted-foreground">{time}</span>
          {assistant && message.model && <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[8px] font-medium text-slate-500">{message.model}</span>}
        </div>
        <div className={cn("whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-700", assistant && "text-[13.5px]", message.failed && "text-red-700")}>
          {message.content || (message.streaming ? "Thinking with your document" : "")}
          {message.streaming && <span className="ml-1 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-primary align-middle" />}
        </div>
        {assistant && !message.streaming && !message.failed && (
          <div className="mt-3 flex items-center gap-1">
            {message.citations.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-[9px] font-medium shadow-none" onClick={onShowSources}>
                <span className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary text-[8px] text-white">{message.citations.length}</span>
                {message.citations.length === 1 ? "source" : "sources"}
              </Button>
            )}
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => void copyMessage()} aria-label="Copy response"><Copy className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Copy response</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onFeedback(1)} aria-label="Helpful"><ThumbsUp className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Helpful</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onFeedback(-1)} aria-label="Not helpful"><ThumbsDown className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Not helpful</TooltipContent></Tooltip>
          </div>
        )}
      </div>
    </article>
  );
}
