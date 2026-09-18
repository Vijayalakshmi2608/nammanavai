import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const caller = () => appRouter.createCaller({ req: {}, res: {}, user: null } as any);

afterEach(() => { process.env.MOCK_SERPAPI = "true"; vi.restoreAllMocks(); });

describe("NammaNav TrustPath", () => {
  it("returns a privacy-safe Decision Contract and explicit verdict", async () => {
    const result = await caller().nammaNav.recommend({
      text: "Find a quiet study place near Anna Nagar with Wi-Fi",
      broadLocation: "Anna Nagar, Chennai",
      mustHave: ["Wi-Fi"],
      accessibility: [],
      openNow: true,
      currentCheck: false,
      privacyMode: true,
      riskIfWrong: "I could waste an evening",
      requiredProof: "Current hours and Wi-Fi",
      acceptableFallback: "A library nearby",
    });

    expect(result.decisionContract).toMatchObject({
      riskIfWrong: "I could waste an evening",
      requiredProof: "Current hours and Wi-Fi",
      acceptableFallback: "A library nearby",
    });
    expect(["Proceed", "Proceed with caution", "Verify before acting", "Avoid for this goal", "No safe match found"]).toContain(result.verdict);
    expect(JSON.stringify(result)).not.toContain("SERPAPI_KEY");
  }, 15000);

  it("exposes risk-aware score components and bounded challenge purpose", async () => {
    const result = await caller().nammaNav.recommend({
      text: "Find a quiet study place near Anna Nagar with Wi-Fi and charging",
      broadLocation: "Anna Nagar, Chennai",
      mustHave: ["Wi-Fi", "charging points"],
      accessibility: [],
      openNow: true,
      currentCheck: false,
      privacyMode: true,
    });

    expect(result.tasks.some((task: any) => task.purpose === "challenge recommendation")).toBe(true);
    expect(result.recommendations[0]?.scoreBreakdown).toMatchObject({ fitScore: expect.any(Number), evidenceConfidence: expect.any(Number), uncertaintyPenalty: expect.any(Number), conflictPenalty: expect.any(Number), staleDataPenalty: expect.any(Number), challengePenalty: expect.any(Number), finalScore: expect.any(Number) });
    expect(result.mission.requestCount).toBeLessThanOrEqual(result.telemetry.maxRequestsPerWorkflow);
    expect(result.dossier.decisionContract).toBeDefined();
  });

  it("preserves conflicting and stale evidence instead of resolving it silently", async () => {
    process.env.MOCK_SERPAPI = "false";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ local_results: [{ title: "Test Study Cafe", open_state: "Open now", rating: 4.2, link: "https://example.test/place" }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ organic_results: [{ title: "Test Study Cafe temporarily closed", snippet: "Temporarily closed", date: "2020-01-01", link: "https://example.test/conflict" }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ organic_results: [] }) } as Response);

    const result = await caller().nammaNav.recommend({ text: "Find a study cafe near Anna Nagar", broadLocation: "Anna Nagar, Chennai", mustHave: [], accessibility: [], openNow: true, currentCheck: false, privacyMode: true });
    expect(result.evidenceGraph.some((edge: any) => edge.polarity === "conflicting")).toBe(true);
    expect(result.evidenceGraph.some((edge: any) => edge.polarity === "stale")).toBe(true);
    expect(result.recommendations[0]?.scoreBreakdown.conflictPenalty).toBeGreaterThan(0);
  }, 15000);
});
