import { describe, expect, it } from "vitest";

import { citationMatchLevel, displayDocumentName, formatFileSize } from "@/lib/utils";

describe("document display helpers", () => {
  it("creates a readable title from a stored filename", () => {
    expect(displayDocumentName("employee_handbook-v2.pdf")).toBe("employee handbook v2");
  });

  it("formats file sizes", () => {
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });
});

describe("citationMatchLevel", () => {
  it("uses the server-provided level when available", () => {
    expect(citationMatchLevel({ match_level: "Exact", score: 0.1 })).toBe("exact");
  });

  it("falls back to score thresholds", () => {
    expect(citationMatchLevel({ score: 0.72 })).toBe("high");
    expect(citationMatchLevel({ score: 0.2 })).toBe("low");
  });
});
