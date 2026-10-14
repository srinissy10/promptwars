import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Chat, type WorkspaceTab } from "@/components/chat/Chat";
import { DashboardView } from "@/components/documents/DashboardView";
import { LibrarySidebar, type SidebarNavView } from "@/components/layout/LibrarySidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Settings } from "@/components/settings/Settings";
import { SourcesPanel } from "@/components/sources/SourcesPanel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { sessionStorage } from "@/lib/storage";
import { getErrorMessage } from "@/lib/utils";
import type { Citation, Conversation, Document, Message } from "@/types/api";

export function Workspace() {
  const { api, settings } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false);
  const [desktopSourcesOpen, setDesktopSourcesOpen] = useState(() => window.localStorage.getItem("docchat_sources_hidden") !== "true");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => sessionStorage.getModel() || settings?.chat_model || "");
  const [activeNav, setActiveNav] = useState<SidebarNavView>("dashboard");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");

  const documentListQuery = useQuery({
    queryKey: ["documents", debouncedSearch],
    queryFn: () => api.listDocuments(debouncedSearch),
    retry: 1,
    refetchInterval: (query) => query.state.data?.some((document) => document.status === "processing") ? 1_800 : false,
  });

  const selectedDocumentQuery = useQuery({
    queryKey: ["document", selectedDocumentId],
    queryFn: () => api.getDocument(selectedDocumentId!),
    enabled: Boolean(selectedDocumentId),
    retry: 1,
    refetchInterval: (query) => query.state.data?.status === "processing" ? 1_800 : false,
  });

  const selectedDocument = selectedDocumentQuery.data ?? documentListQuery.data?.find((document) => document.id === selectedDocumentId) ?? null;

  const conversationsQuery = useQuery({
    queryKey: ["conversations", selectedDocumentId],
    queryFn: () => api.listConversations(selectedDocumentId!),
    enabled: Boolean(selectedDocumentId && selectedDocument?.status === "ready"),
    retry: 1,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => api.listMessages(selectedConversationId!),
    enabled: Boolean(selectedConversationId),
    retry: 1,
  });

  useEffect(() => {
    const configuredModels = settings?.chat_models?.length ? settings.chat_models : settings ? [{ id: settings.chat_model }] : [];
    if (!configuredModels.length) return;
    if (!configuredModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(settings!.chat_model);
      sessionStorage.setModel(settings!.chat_model);
    }
  }, [selectedModel, settings]);

  useEffect(() => {
    const conversations = conversationsQuery.data;
    if (!conversations?.length) {
      if (conversations && selectedConversationId) setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId || !conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  useEffect(() => {
    const latest = [...(messagesQuery.data ?? [])].reverse().find((message) => message.role === "assistant" && message.citations.length);
    setCitations(latest?.citations ?? []);
  }, [messagesQuery.data, selectedConversationId]);

  useEffect(() => {
    window.localStorage.setItem("docchat_sources_hidden", String(!desktopSourcesOpen));
  }, [desktopSourcesOpen]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file, setUploadProgress),
    onMutate: () => setUploadProgress(0),
    onSuccess: async (document) => {
      setSearch("");
      queryClient.setQueryData(["document", document.id], document);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      selectDocument(document.id, document);
      toast.success("Upload complete", { description: "DocChat is preparing the document for search." });
    },
    onError: (error, file) => toast.error("Upload failed", { description: getErrorMessage(error), action: { label: "Try again", onClick: () => uploadMutation.mutate(file) } }),
    onSettled: () => setUploadProgress(null),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => api.deleteDocument(documentId),
    onSuccess: async (_, documentId) => {
      queryClient.removeQueries({ queryKey: ["document", documentId] });
      setSelectedDocumentId(null);
      setSelectedConversationId(null);
      setCitations([]);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted", { description: "Its file, conversations, and local index were removed." });
    },
    onError: (error) => toast.error("Couldn’t delete document", { description: getErrorMessage(error) }),
  });

  const reindexMutation = useMutation({
    mutationFn: (documentId: string) => api.reindexDocument(documentId),
    onSuccess: async (_, documentId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
      ]);
      toast.success("Reindexing started");
    },
    onError: (error) => toast.error("Couldn’t reindex document", { description: getErrorMessage(error) }),
  });

  const createConversationMutation = useMutation({
    mutationFn: () => api.createConversation(selectedDocumentId!),
    onSuccess: (conversation) => {
      queryClient.setQueryData<Conversation[]>(["conversations", selectedDocumentId], (items = []) => [conversation, ...items]);
      queryClient.setQueryData<Message[]>(["messages", conversation.id], []);
      setSelectedConversationId(conversation.id);
      setCitations([]);
      setNavigationOpen(false);
    },
    onError: (error) => toast.error("Couldn’t create conversation", { description: getErrorMessage(error) }),
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => api.deleteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      const remaining = (conversationsQuery.data ?? []).filter((conversation) => conversation.id !== conversationId);
      queryClient.setQueryData(["conversations", selectedDocumentId], remaining);
      queryClient.removeQueries({ queryKey: ["messages", conversationId] });
      if (selectedConversationId === conversationId) setSelectedConversationId(remaining[0]?.id ?? null);
      toast.success("Conversation deleted");
    },
    onError: (error) => toast.error("Couldn’t delete conversation", { description: getErrorMessage(error) }),
  });

  const models = useMemo(() => {
    if (!settings) return [];
    return settings.chat_models?.length ? settings.chat_models : [{ id: settings.chat_model, label: settings.chat_model }];
  }, [settings]);

  function selectDocument(documentId: string, document?: Document) {
    if (document) queryClient.setQueryData(["document", documentId], document);
    setSelectedDocumentId(documentId);
    setSelectedConversationId(null);
    setCitations([]);
    setNavigationOpen(false);
    setActiveNav("chat");
    setActiveTab("chat");
  }

  function selectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    setCitations([]);
    setNavigationOpen(false);
    setActiveNav("chat");
    setActiveTab("chat");
  }

  function handleSelectNav(view: SidebarNavView) {
    setActiveNav(view);
    if (view === "dashboard") {
      setActiveTab("chat");
      return;
    }
    if (view === "documents") {
      setActiveTab("chat");
      return;
    }
    if (view === "chat") {
      setActiveTab("chat");
      return;
    }
    if (view === "summary") {
      setActiveTab("summary");
      return;
    }
    if (view === "checklist") {
      setActiveTab("checklist");
      return;
    }
    if (view === "versions") {
      setActiveTab("versions");
      return;
    }
  }

  function handleTabChange(tab: WorkspaceTab) {
    setActiveTab(tab);
    if (tab === "chat") setActiveNav("chat");
    if (tab === "summary") setActiveNav("summary");
    if (tab === "checklist") setActiveNav("checklist");
    if (tab === "versions") setActiveNav("versions");
  }

  function upload(file: File) {
    if (!settings) return;
    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!settings.allowed_extensions.map((value) => value.toLowerCase()).includes(extension)) {
      toast.error("Unsupported file type", { description: `Choose ${settings.allowed_extensions.join(", ")}.` });
      return;
    }
    if (file.size > settings.max_file_mb * 1024 * 1024) {
      toast.error("File is too large", { description: `The upload limit is ${settings.max_file_mb} MB.` });
      return;
    }
    uploadMutation.mutate(file);
  }

  function changeModel(model: string) {
    setSelectedModel(model);
    sessionStorage.setModel(model);
    const label = models.find((item) => item.id === model)?.label || model;
    toast.success(`Model changed to ${label}`);
  }

  function showSources(nextCitations: Citation[]) {
    setCitations(nextCitations);
    if (window.matchMedia("(min-width: 1280px)").matches) setDesktopSourcesOpen(true);
    else setMobileSourcesOpen(true);
  }

  function toggleSources() {
    if (window.matchMedia("(min-width: 1280px)").matches) setDesktopSourcesOpen((value) => !value);
    else setMobileSourcesOpen(true);
  }

  function choosePrompt(prompt: string) {
    setDraftPrompt(null);
    window.requestAnimationFrame(() => setDraftPrompt(prompt));
  }

  async function sendMessage(content: string) {
    if (!settings || !selectedDocument || selectedDocument.status !== "ready" || chatBusy) return;
    setChatBusy(true);
    setDraftPrompt(null);
    let conversationId = selectedConversationId;
    try {
      if (!conversationId) {
        const conversation = await api.createConversation(selectedDocument.id);
        conversationId = conversation.id;
        queryClient.setQueryData<Conversation[]>(["conversations", selectedDocument.id], (items = []) => [conversation, ...items]);
        queryClient.setQueryData<Message[]>(["messages", conversationId], []);
        setSelectedConversationId(conversationId);
      }

      const now = new Date().toISOString();
      let userMessageId = `local-user-${crypto.randomUUID()}`;
      let assistantMessageId = `local-assistant-${crypto.randomUUID()}`;
      const userMessage: Message = { id: userMessageId, conversation_id: conversationId, role: "user", content, citations: [], model: null, input_tokens: 0, output_tokens: 0, created_at: now };
      const assistantMessage: Message = { id: assistantMessageId, conversation_id: conversationId, role: "assistant", content: "", citations: [], model: selectedModel, input_tokens: 0, output_tokens: 0, created_at: now, streaming: true };
      const messageKey = ["messages", conversationId];
      queryClient.setQueryData<Message[]>(messageKey, (items = []) => [...items, userMessage, assistantMessage]);

      const updateAssistant = (update: (message: Message) => Message) => {
        queryClient.setQueryData<Message[]>(messageKey, (items = []) => items.map((message) => message.id === assistantMessageId ? update(message) : message));
      };

      await api.streamMessage(conversationId, content, selectedModel, {
        message: (data) => {
          const previousUserId = userMessageId;
          const previousAssistantId = assistantMessageId;
          userMessageId = data.user_message_id;
          assistantMessageId = data.assistant_message_id;
          queryClient.setQueryData<Message[]>(messageKey, (items = []) => items.map((message) => {
            if (message.id === previousUserId) return { ...message, id: userMessageId };
            if (message.id === previousAssistantId) return { ...message, id: assistantMessageId };
            return message;
          }));
        },
        token: ({ text }) => updateAssistant((message) => ({ ...message, content: message.content + text })),
        citations: (nextCitations) => {
          updateAssistant((message) => ({ ...message, citations: nextCitations }));
          setCitations(nextCitations);
        },
        metadata: (metadata) => {
          updateAssistant((message) => ({ ...message, model: metadata.model, input_tokens: metadata.input_tokens, output_tokens: metadata.output_tokens }));
          if (metadata.warning) toast.warning("Answer generated with a fallback", { description: metadata.warning });
        },
        done: () => updateAssistant((message) => ({ ...message, streaming: false })),
      }, (settings.chat_timeout_seconds + 5) * 1000);

      await queryClient.invalidateQueries({ queryKey: ["conversations", selectedDocument.id] });
    } catch (error) {
      if (conversationId) {
        queryClient.setQueryData<Message[]>(["messages", conversationId], (items = []) => items.map((message) => message.streaming ? { ...message, streaming: false, failed: true, content: `Couldn’t generate an answer: ${getErrorMessage(error)}` } : message));
      }
      toast.error("Couldn’t generate an answer", { description: getErrorMessage(error) });
    } finally {
      setChatBusy(false);
    }
  }

  async function submitFeedback(messageId: string, rating: -1 | 1) {
    try {
      await api.submitFeedback(messageId, rating);
      toast.success("Feedback saved locally");
    } catch (error) {
      toast.error("Couldn’t save feedback", { description: getErrorMessage(error) });
    }
  }

  if (!settings) return null;

  const sidebarProps = {
    documents: documentListQuery.data ?? [],
    conversations: conversationsQuery.data ?? [],
    selectedDocumentId,
    selectedConversationId,
    selectedDocumentStatus: selectedDocument?.status ?? null,
    activeNav,
    search,
    documentsLoading: documentListQuery.isLoading,
    documentsError: documentListQuery.error,
    conversationsLoading: conversationsQuery.isLoading,
    conversationsError: conversationsQuery.error,
    creatingConversation: createConversationMutation.isPending,
    deletingConversationId: deleteConversationMutation.isPending ? deleteConversationMutation.variables : null,
    uploadProgress,
    uploading: uploadMutation.isPending,
    allowedExtensions: settings.allowed_extensions,
    maxFileMb: settings.max_file_mb,
    onSelectNav: handleSelectNav,
    onOpenSettings: () => setSettingsOpen(true),
    onSearch: setSearch,
    onSelectDocument: (id: string) => selectDocument(id, documentListQuery.data?.find((document) => document.id === id)),
    onSelectConversation: selectConversation,
    onCreateConversation: () => createConversationMutation.mutate(),
    onDeleteConversation: (id: string) => deleteConversationMutation.mutate(id),
    onUpload: upload,
    onRetryDocuments: () => void documentListQuery.refetch(),
    onRetryConversations: () => void conversationsQuery.refetch(),
  };

  const renderContent = () => {
    if (activeNav === "dashboard") {
      return (
        <DashboardView
          documents={documentListQuery.data ?? []}
          onSelectDocument={(id) => selectDocument(id, documentListQuery.data?.find((document) => document.id === id))}
          onOpenUpload={() => setNavigationOpen(true)}
          onNavigateTab={(tab) => {
            setActiveNav(tab === "chat" || tab === "compress" ? "chat" : tab);
            setActiveTab(tab);
          }}
        />
      );
    }

    return (
      <Chat
        document={selectedDocument}
        messages={messagesQuery.data ?? []}
        models={models}
        selectedModel={selectedModel}
        activeTab={activeTab}
        messageLoading={messagesQuery.isLoading}
        messageError={messagesQuery.error}
        busy={chatBusy}
        deleting={deleteDocumentMutation.isPending}
        reindexing={reindexMutation.isPending}
        draftPrompt={draftPrompt}
        onTabChange={handleTabChange}
        onModelChange={changeModel}
        onDeleteDocument={() => selectedDocument && deleteDocumentMutation.mutate(selectedDocument.id)}
        onReindex={() => selectedDocument && reindexMutation.mutate(selectedDocument.id)}
        onRetryMessages={() => void messagesQuery.refetch()}
        onSend={(message) => void sendMessage(message)}
        onPrompt={choosePrompt}
        onShowSources={showSources}
        onFeedback={(messageId, rating) => void submitFeedback(messageId, rating)}
      />
    );
  };

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#f5f6f8]">
      <TopBar sourceCount={citations.length} onOpenNavigation={() => setNavigationOpen(true)} onOpenSources={toggleSources} onOpenSettings={() => setSettingsOpen(true)} />
      <div className={`grid min-h-0 flex-1 overflow-hidden ${desktopSourcesOpen ? "lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_330px]" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
        <aside className="hidden h-full min-h-0 overflow-hidden border-r lg:block"><LibrarySidebar {...sidebarProps} /></aside>
        {renderContent()}
        {desktopSourcesOpen && <div className="hidden h-full min-h-0 overflow-hidden border-l xl:block"><SourcesPanel citations={citations} onClose={() => setDesktopSourcesOpen(false)} /></div>}
      </div>

      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SheetContent side="left" className="w-[310px] max-w-[90vw]">
          <SheetHeader className="sr-only"><SheetTitle>Document navigation</SheetTitle><SheetDescription>Choose a document and conversation.</SheetDescription></SheetHeader>
          <LibrarySidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileSourcesOpen} onOpenChange={setMobileSourcesOpen}>
        <SheetContent side="right" className="w-[380px] max-w-[94vw]">
          <SheetHeader className="sr-only"><SheetTitle>Answer sources</SheetTitle><SheetDescription>Passages used for the selected answer.</SheetDescription></SheetHeader>
          <SourcesPanel citations={citations} embedded />
        </SheetContent>
      </Sheet>

      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
