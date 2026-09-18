import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const caller = () => appRouter.createCaller({ req: {}, res: {}, user: null } as any);

describe("production quality outputs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.MOCK_SERPAPI = "true";
  });

  it("returns inspectable evidence, telemetry, dossier, trust, and privacy-safe history data", async () => {
    process.env.MOCK_SERPAPI = "true";
    const result = await caller().nammaNav.recommend({
      text: "Find a quiet study place near Anna Nagar under ₹300 with Wi-Fi",
      broadLocation: "Anna Nagar, Chennai",
      budget: 300,
      maxDistance: 5,
      mustHave: ["Wi-Fi"],
      accessibility: [],
      openNow: true,
      currentCheck: true,
      privacyMode: true,
    });

    expect(result.evidenceGraph[0]).toMatchObject({ engine: expect.any(String), retrievedAt: expect.any(String), supports: expect.any(Boolean) });
    expect(result.telemetry).toMatchObject({ requestsUsed: 0, remainingWorkflowAllowance: 5, errors: 0 });
    expect(result.dossier).toMatchObject({ generatedAt: expect.any(String), providerTelemetry: [], limitations: expect.any(Array) });
    expect(result.trust).toHaveProperty("whatCouldChangeDecision");
    expect(JSON.stringify(result.dossier)).not.toContain("SERPAPI_KEY");
    expect(JSON.stringify(result.dossier)).not.toContain("@example.com");
  });

  it("records provider timeout/error telemetry without leaking credentials", async () => {
    process.env.MOCK_SERPAPI = "false";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    const result = await caller().nammaNav.recommend({
      text: "Find a pharmacy near Anna Nagar",
      broadLocation: "Anna Nagar, Chennai",
      mustHave: [],
      accessibility: [],
      openNow: true,
      currentCheck: false,
      privacyMode: true,
    });

    expect(result.providerError).toBe("timeout");
    expect(result.telemetry.errors).toBeGreaterThan(0);
    expect(result.providerTelemetry[0]).toMatchObject({ status: "error", timedOut: true, resultCount: 0 });
    expect(JSON.stringify(result)).not.toContain("SERPAPI_KEY");
  });
});
