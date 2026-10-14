import { MessageSquare, MessageSquarePlus, MoreHorizontal, Trash2 } from "lucide-react";

import { LoadingState } from "@/components/common/LoadingState";
import { QueryError } from "@/components/common/QueryError";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Conversation, DocumentStatus } from "@/types/api";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  documentStatus: DocumentStatus;
  loading: boolean;
  error: unknown;
  creating: boolean;
  deletingId: string | null;
  onSelect: (conversationId: string) => void;
  onCreate: () => void;
  onDelete: (conversationId: string) => void;
  onRetry: () => void;
}

export function ConversationList(props: ConversationListProps) {
  const ready = props.documentStatus === "ready";
  return (
    <section className="border-t px-2 pb-3 pt-4">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Conversations</p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={props.onCreate} disabled={!ready || props.creating}>
          <MessageSquarePlus className="h-3.5 w-3.5" /> {props.creating ? "Creating…" : "New"}
        </Button>
      </div>

      {props.loading ? <LoadingState rows={3} /> : props.error ? <QueryError compact error={props.error} onRetry={props.onRetry} /> : props.conversations.length ? (
        <div className="space-y-0.5">
          {props.conversations.map((conversation) => (
            <div key={conversation.id} className={cn("group flex items-center rounded-md pr-1 transition-colors hover:bg-slate-100", props.selectedId === conversation.id && "bg-primary/[0.07] text-primary hover:bg-primary/[0.07]")}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left focus-visible:outline-none" onClick={() => props.onSelect(conversation.id)}>
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">{conversation.title}</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{formatRelativeTime(conversation.updated_at)}</span>
                </span>
              </button>
              <AlertDialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Conversation actions"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem className="text-destructive focus:bg-red-50 focus:text-destructive" onSelect={(event) => event.preventDefault()}>
                        <Trash2 /> Delete conversation
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                    <AlertDialogDescription>The messages and citations in “{conversation.title}” will be permanently removed.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => props.onDelete(conversation.id)} disabled={props.deletingId === conversation.id}>
                      {props.deletingId === conversation.id ? "Deleting…" : "Delete conversation"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-2 rounded-lg border border-dashed bg-white/60 px-3 py-5 text-center">
          <MessageSquare className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            {ready ? "Start a new conversation to ask your first question." : props.documentStatus === "failed" ? "Reindex the document before starting a conversation." : "Conversations will be available when processing finishes."}
          </p>
        </div>
      )}
    </section>
  );
}
