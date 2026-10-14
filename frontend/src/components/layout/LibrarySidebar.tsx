import {
  Files,
  GraduationCap,
  History,
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";

import { ConversationList } from "@/components/conversations/ConversationList";
import { DocumentList } from "@/components/documents/DocumentList";
import type { Conversation, Document, DocumentStatus } from "@/types/api";

export type SidebarNavView = "dashboard" | "documents" | "chat" | "summary" | "checklist" | "versions";

interface LibrarySidebarProps {
  documents: Document[];
  conversations: Conversation[];
  selectedDocumentId: string | null;
  selectedConversationId: string | null;
  selectedDocumentStatus: DocumentStatus | null;
  activeNav: SidebarNavView;
  search: string;
  documentsLoading: boolean;
  documentsError: unknown;
  conversationsLoading: boolean;
  conversationsError: unknown;
  creatingConversation: boolean;
  deletingConversationId: string | null;
  uploadProgress: number | null;
  uploading: boolean;
  allowedExtensions: string[];
  maxFileMb: number;
  onSelectNav: (view: SidebarNavView) => void;
  onOpenSettings: () => void;
  onSearch: (value: string) => void;
  onSelectDocument: (id: string) => void;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onUpload: (file: File) => void;
  onRetryDocuments: () => void;
  onRetryConversations: () => void;
}

export function LibrarySidebar(props: LibrarySidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "My Documents", icon: Files, badge: props.documents.length },
    { id: "chat", label: "AI Document Chat", icon: MessageSquare },
    { id: "summary", label: "AI Summary", icon: Sparkles },
    { id: "checklist", label: "Scholarship Checklist", icon: GraduationCap },
    { id: "versions", label: "Version History", icon: History },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8f9fa] border-r">
      {/* Top Sidebar Navigation */}
      <div className="shrink-0 p-3 border-b bg-white/70">
        <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace Navigation
        </p>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = props.activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onSelectNav(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {"badge" in item && item.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={props.onOpenSettings}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <SettingsIcon className="h-4 w-4 text-slate-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Document Library and Conversations */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <DocumentList
          documents={props.documents}
          selectedId={props.selectedDocumentId}
          search={props.search}
          loading={props.documentsLoading}
          error={props.documentsError}
          allowedExtensions={props.allowedExtensions}
          maxFileMb={props.maxFileMb}
          uploadProgress={props.uploadProgress}
          uploading={props.uploading}
          onSearch={props.onSearch}
          onSelect={props.onSelectDocument}
          onUpload={props.onUpload}
          onRetry={props.onRetryDocuments}
        />
        {props.selectedDocumentStatus && (
          <ConversationList
            conversations={props.conversations}
            selectedId={props.selectedConversationId}
            documentStatus={props.selectedDocumentStatus}
            loading={props.conversationsLoading}
            error={props.conversationsError}
            creating={props.creatingConversation}
            deletingId={props.deletingConversationId}
            onSelect={props.onSelectConversation}
            onCreate={props.onCreateConversation}
            onDelete={props.onDeleteConversation}
            onRetry={props.onRetryConversations}
          />
        )}
      </div>
    </div>
  );
}
