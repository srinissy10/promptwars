import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";

describe("DocumentStatusBadge", () => {
  it("renders a clear processing state", () => {
    render(<DocumentStatusBadge status="processing" />);
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });
});
