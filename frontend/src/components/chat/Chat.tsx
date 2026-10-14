import {
  Eye,
  FileArchive,
  GraduationCap,
  History,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { DocumentChecklistTab } from "@/components/documents/DocumentChecklistTab";
import { DocumentCompressTab } from "@/components/documents/DocumentCompressTab";
import { DocumentPreviewTab } from "@/components/documents/DocumentPreviewTab";
import { DocumentSummaryTab } from "@/components/documents/DocumentSummaryTab";
import { DocumentVersionsTab } from "@/components/documents/DocumentVersionsTab";
import type { ChatModel, Citation, Document, Message } from "@/types/api";

export type WorkspaceTab = "chat" | "preview" | "summary" | "versions" | "compress" | "checklist";

interface ChatProps {
  document: Document | null;
  messages: Message[];
  models: ChatModel[];
  selectedModel: string;
  activeTab: WorkspaceTab;
  messageLoading: boolean;
  messageError: unknown;
  busy: boolean;
  deleting: boolean;
  reindexing: boolean;
  draftPrompt: string | null;
  onTabChange: (tab: WorkspaceTab) => void;
  onModelChange: (model: string) => void;
  onDeleteDocument: () => void;
  onReindex: () => void;
  onRetryMessages: () => void;
  onSend: (message: string) => void;
  onPrompt: (prompt: string) => void;
  onShowSources: (citations: Citation[]) => void;
  onFeedback: (messageId: string, rating: -1 | 1) => void;
}

export function Chat(props: ChatProps) {
  const tabs = [
    { id: "chat", label: "AI Chat", icon: MessageSquare },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "summary", label: "AI Summary", icon: Sparkles },
    { id: "versions", label: "Version History", icon: History },
    { id: "compress", label: "PDF Compression", icon: FileArchive },
    { id: "checklist", label: "Scholarship Checklist", icon: GraduationCap },
  ] as const;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <ChatHeader
        document={props.document}
        models={props.models}
        selectedModel={props.selectedModel}
        deleting={props.deleting}
        reindexing={props.reindexing}
        onModelChange={props.onModelChange}
        onDelete={props.onDeleteDocument}
        onReindex={props.onReindex}
      />

      {/* Workspace Feature Navigation Tabs */}
      {props.document && (
        <div className="shrink-0 border-b bg-slate-50/70 px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = props.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => props.onTabChange(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors shrink-0 ${
                  isActive
                    ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-medium"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Panels */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {!props.document || props.activeTab === "chat" ? (
          <div className="flex h-full flex-col overflow-hidden">
            <MessageList
              document={props.document}
              messages={props.messages}
              loading={props.messageLoading}
              error={props.messageError}
              onRetry={props.onRetryMessages}
              onPrompt={props.onPrompt}
              onShowSources={props.onShowSources}
              onFeedback={props.onFeedback}
              onReindex={props.onReindex}
            />
            <Composer
              documentStatus={props.document?.status ?? null}
              busy={props.busy}
              draftPrompt={props.draftPrompt}
              onSend={props.onSend}
            />
          </div>
        ) : props.activeTab === "preview" ? (
          <DocumentPreviewTab document={props.document} />
        ) : props.activeTab === "summary" ? (
          <DocumentSummaryTab document={props.document} />
        ) : props.activeTab === "versions" ? (
          <DocumentVersionsTab document={props.document} />
        ) : props.activeTab === "compress" ? (
          <DocumentCompressTab document={props.document} />
        ) : (
          <DocumentChecklistTab document={props.document} />
        )}
      </div>
    </section>
  );
}
