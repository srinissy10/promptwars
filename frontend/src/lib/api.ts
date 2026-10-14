import type {
  AuthResponse,
  Citation,
  Conversation,
  Document,
  DocumentPreview,
  DocumentSummary,
  DocumentVersion,
  Message,
  PdfCompressionResult,
  ScholarshipChecklist,
  Settings,
  StreamHandlers,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: BodyInit | object | null };

async function parseError(response: Response) {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  let detail = `Request failed (${response.status})`;
  try {
    const payload = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof payload.detail === "string") detail = payload.detail;
    else if (Array.isArray(payload.detail)) detail = payload.detail.map((item) => item.msg).filter(Boolean).join(" · ") || detail;
  } catch {
    // The status code remains useful when the response has no JSON body.
  }
  return new ApiError(detail, response.status, requestId);
}

export class ApiClient {
  constructor(
    private getToken: () => string | null,
    private onUnauthorized: () => void,
  ) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    const token = this.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let body = options.body as BodyInit | null | undefined;
    if (body && !(body instanceof FormData) && typeof body !== "string") {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(path, { ...options, headers, body });
    } catch {
      throw new ApiError("Cannot reach DocChat. Check that the local server is running.", 0);
    }

    if (response.status === 401 && !path.includes("/auth/")) this.onUnauthorized();
    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  authenticate(mode: "login" | "register", email: string, password: string) {
    return this.request<AuthResponse>(`/api/auth/${mode}`, {
      method: "POST",
      body: { email, password },
    });
  }

  getSettings() {
    return this.request<Settings>("/api/settings");
  }

  listDocuments(search = "") {
    return this.request<Document[]>(`/api/documents?search=${encodeURIComponent(search)}`);
  }

  getDocument(documentId: string) {
    return this.request<Document>(`/api/documents/${documentId}`);
  }

  deleteDocument(documentId: string) {
    return this.request<void>(`/api/documents/${documentId}`, { method: "DELETE" });
  }

  reindexDocument(documentId: string) {
    return this.request<Pick<Document, "id" | "status">>(`/api/documents/${documentId}/reindex`, { method: "POST" });
  }

  uploadDocument(file: File, onProgress: (progress: number) => void) {
    return new Promise<Document>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/api/documents");
      const token = this.getToken();
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener("load", () => {
        if (request.status === 401) this.onUnauthorized();
        if (request.status >= 200 && request.status < 300) {
          try {
            resolve(JSON.parse(request.responseText) as Document);
          } catch {
            reject(new ApiError("The upload completed but the response was invalid.", request.status));
          }
          return;
        }
        try {
          const payload = JSON.parse(request.responseText) as { detail?: string };
          reject(new ApiError(payload.detail || `Upload failed (${request.status})`, request.status));
        } catch {
          reject(new ApiError(`Upload failed (${request.status})`, request.status));
        }
      });
      request.addEventListener("error", () => reject(new ApiError("Upload interrupted. Check your connection and retry.", 0)));
      const form = new FormData();
      form.append("file", file);
      request.send(form);
    });
  }

  replaceDocument(documentId: string, file: File, onProgress?: (progress: number) => void) {
    return new Promise<Document>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/documents/${documentId}/replace`);
      const token = this.getToken();
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      if (onProgress) {
        request.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        });
      }
      request.addEventListener("load", () => {
        if (request.status === 401) this.onUnauthorized();
        if (request.status >= 200 && request.status < 300) {
          try {
            resolve(JSON.parse(request.responseText) as Document);
          } catch {
            reject(new ApiError("Replacement completed but response was invalid.", request.status));
          }
          return;
        }
        try {
          const payload = JSON.parse(request.responseText) as { detail?: string };
          reject(new ApiError(payload.detail || `Replacement failed (${request.status})`, request.status));
        } catch {
          reject(new ApiError(`Replacement failed (${request.status})`, request.status));
        }
      });
      request.addEventListener("error", () => reject(new ApiError("Replacement network error.", 0)));
      const form = new FormData();
      form.append("file", file);
      request.send(form);
    });
  }

  listVersions(documentId: string) {
    return this.request<DocumentVersion[]>(`/api/documents/${documentId}/versions`);
  }

  summarizeDocument(documentId: string) {
    return this.request<DocumentSummary>(`/api/documents/${documentId}/summarize`, {
      method: "POST",
    });
  }

  compressDocument(documentId: string, replaceOriginal = false) {
    return this.request<PdfCompressionResult>(
      `/api/documents/${documentId}/compress?replace_original=${replaceOriginal}`,
      { method: "POST" },
    );
  }

  extractChecklist(documentId: string) {
    return this.request<ScholarshipChecklist>(`/api/documents/${documentId}/extract-checklist`, {
      method: "POST",
    });
  }

  previewDocument(documentId: string) {
    return this.request<DocumentPreview>(`/api/documents/${documentId}/preview`);
  }

  getDownloadUrl(documentId: string) {
    return `/api/documents/${documentId}/download`;
  }

  getFileUrl(documentId: string) {
    return `/api/documents/${documentId}/file`;
  }

  listConversations(documentId: string) {
    return this.request<Conversation[]>(`/api/documents/${documentId}/conversations`);
  }

  createConversation(documentId: string, title = "New conversation") {
    return this.request<Conversation>(`/api/documents/${documentId}/conversations`, {
      method: "POST",
      body: { title },
    });
  }

  renameConversation(conversationId: string, title: string) {
    return this.request<Conversation>(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      body: { title },
    });
  }

  deleteConversation(conversationId: string) {
    return this.request<void>(`/api/conversations/${conversationId}`, { method: "DELETE" });
  }

  listMessages(conversationId: string) {
    return this.request<Message[]>(`/api/conversations/${conversationId}/messages`);
  }

  submitFeedback(messageId: string, rating: -1 | 1) {
    return this.request(`/api/messages/${messageId}/feedback`, {
      method: "POST",
      body: { rating },
    });
  }

  updateApiKey(apiKey: string) {
    return this.request<{ openai_configured: boolean }>("/api/settings/openai-key", {
      method: "PUT",
      body: { api_key: apiKey },
    });
  }

  clearApiKey() {
    return this.request<{ openai_configured: boolean }>("/api/settings/openai-key", { method: "DELETE" });
  }

  async streamMessage(
    conversationId: string,
    content: string,
    model: string,
    handlers: StreamHandlers,
    timeoutMs: number,
  ) {
    const token = this.getToken();
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let receivedDone = false;
    const timeoutId = window.setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    let response: Response;
    try {
      response = await fetch(`/api/conversations/${conversationId}/messages/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, model }),
        signal: controller.signal,
      });
      if (response.status === 401) this.onUnauthorized();
      if (!response.ok) throw await parseError(response);
      if (!response.body) throw new ApiError("The server returned an empty stream.", response.status);

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      streamLoop: while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (error) {
          if (controller.signal.aborted) {
            throw new ApiError("This answer took too long. Please try again.", 408);
          }
          throw error;
        }
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          let event = "message";
          let data: unknown;
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) {
              try {
                data = JSON.parse(line.slice(5).trim()) as unknown;
              } catch {
                throw new ApiError("The server returned an invalid chat stream.", response.status);
              }
            }
          }
          if (event === "error") {
            const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
              ? data.message
              : "MINDMATE could not complete this answer. Please try again.";
            throw new ApiError(message, response.status);
          }
          const handler = handlers[event as keyof StreamHandlers] as ((payload: never) => void) | undefined;
          if (handler && data !== undefined) handler(data as never);
          if (event === "done") {
            receivedDone = true;
            break streamLoop;
          }
        }
      }
      if (!receivedDone) {
        throw new ApiError("The chat stream ended before the answer was complete.", response.status);
      }
    } catch (error) {
      if (controller.signal.aborted && !(error instanceof ApiError)) {
        throw new ApiError("This answer took too long. Please try again.", 408);
      }
      if (error instanceof TypeError) {
        throw new ApiError("Cannot reach DocChat. Check that the local server is running.", 0);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (reader && !receivedDone) {
        void reader.cancel().catch(() => undefined);
      }
    }
  }
}

export const emptyCitations: Citation[] = [];
