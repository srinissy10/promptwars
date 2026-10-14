import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "@/lib/api";

describe("chat streaming", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rejects an SSE error event with the server's safe message", async () => {
    const body = [
      "event: status\ndata: {\"state\":\"processing\"}\n\n",
      "event: error\ndata: {\"message\":\"This conversation is no longer available.\"}\n\n",
    ].join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const api = new ApiClient(() => null, vi.fn());

    await expect(
      api.streamMessage("conversation-1", "Question", "configured-model", {}, 1_000),
    ).rejects.toThrow("This conversation is no longer available.");
  });

  it("rejects a stream that exceeds the configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
      ),
    );
    const api = new ApiClient(() => null, vi.fn());
    const request = api.streamMessage("conversation-1", "Question", "configured-model", {}, 25);
    const rejection = expect(request).rejects.toThrow("This answer took too long. Please try again.");

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
  });

  it("requires a terminal done event before treating the stream as successful", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("event: status\ndata: {}\n\n")));
    const api = new ApiClient(() => null, vi.fn());

    await expect(
      api.streamMessage("conversation-1", "Question", "configured-model", {}, 1_000),
    ).rejects.toThrow("The chat stream ended before the answer was complete.");
  });
});
