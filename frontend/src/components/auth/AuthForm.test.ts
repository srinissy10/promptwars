import { describe, expect, it } from "vitest";

import { createAuthSchema } from "@/components/auth/AuthForm";

describe("registration validation", () => {
  it("rejects an invalid email address", () => {
    const result = createAuthSchema(true).safeParse({ email: "invalid", password: "password123", confirmPassword: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = createAuthSchema(true).safeParse({ email: "person@example.com", password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("requires matching passwords", () => {
    const result = createAuthSchema(true).safeParse({ email: "person@example.com", password: "password123", confirmPassword: "different123" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "confirmPassword")).toBe(true);
  });
});
