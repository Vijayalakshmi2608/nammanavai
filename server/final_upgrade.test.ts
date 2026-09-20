import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const call = () => appRouter.createCaller({ req: {}, res: {}, user: null } as any);

afterEach(() => {
  process.env.MOCK_SERPAPI = "true";
  vi.restoreAllMocks();
});

beforeEach(() => {
  process.env.MOCK_SERPAPI = "true";
});

describe("final NammaNav AI decision-intelligence upgrade", () => {
  it("returns an explicit decision attack surface and stress-test comparisons", async () => {
    const result = await call().nammaNav.recommend({
      text: "Find a quiet place to study near Anna Nagar with Wi-Fi and charging points",
      broadLocation: "Anna Nagar, Chennai",
      budget: 300,
      maxDistance: 5,
      mustHave: ["Wi-Fi", "charging points"],
      accessibility: [],
      openNow: true,
      currentCheck: false,
      privacyMode: true,
    });

    expect(result.attackSurface.length).toBe(8);
    expect(result.attackSurface.every((risk: any) => ["LOW", "MEDIUM", "HIGH", "UNKNOWN"].includes(risk.level))).toBe(true);
    expect(result.stressTests.length).toBeGreaterThanOrEqual(5);
    expect(result.temporalTruth.length).toBeGreaterThan(0);
    expect(result.challengeSummary).toBe("No contradiction found in the searched evidence.");
    expect(result.execution).toMatchObject({ isMock: true, rawSerpApiResponse: {} });
    expect(result.auditStrictness).toBe(0.5);
    expect(result.evidenceGraph.some((edge: any) => edge.claim === "review count")).toBe(true);
  }, 15000);

  it("changes ranking penalty when Audit Strictness changes", async () => {
    const base = await call().nammaNav.recommend({ text: "Find a quiet study cafe near Anna Nagar", broadLocation: "Anna Nagar, Chennai", mustHave: ["Wi-Fi"], accessibility: [], openNow: true, currentCheck: false, privacyMode: true, auditStrictness: 0 });
    const strict = await call().nammaNav.recommend({ text: "Find a quiet study cafe near Anna Nagar", broadLocation: "Anna Nagar, Chennai", mustHave: ["Wi-Fi"], accessibility: [], openNow: true, currentCheck: false, privacyMode: true, auditStrictness: 1 });
    expect(strict.auditStrictness).toBe(1);
    expect(strict.recommendations[0].score).toBeLessThanOrEqual(base.recommendations[0].score);
    expect(strict.recommendations[0].scoreBreakdown.auditStrictness).toBe(1);
  }, 15000);

  it("keeps conflict resolution explicit and dossier-safe", async () => {
    process.env.MOCK_SERPAPI = "false";
    process.env.SERPAPI_KEY = "server-only-test-key";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ local_results: [{ title: "Test Cafe", open_state: "Open now", rating: 4.5, link: "https://example.test/place" }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ organic_results: [{ title: "Test Cafe temporarily closed", snippet: "Temporarily closed", date: "2020-01-01", link: "https://example.test/conflict" }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ organic_results: [] }) } as Response);

    const result = await call().nammaNav.recommend({
      text: "Find a study cafe near Anna Nagar",
      broadLocation: "Anna Nagar, Chennai",
      mustHave: [],
      accessibility: [],
      openNow: true,
      currentCheck: false,
      privacyMode: true,
    });

    expect(result.conflicts.some((item: any) => item.status === "CONFLICTING / UNRESOLVED")).toBe(true);
    expect(result.temporalTruth.some((item: any) => item.classification === "STALE")).toBe(true);
    expect(result.challengeSummary).not.toBe("No contradiction found in the searched evidence.");
    expect(JSON.stringify(result.dossier)).not.toContain("server-only-test-key");
  }, 15000);

  it("keeps provider quota failures visible and bounded", async () => {
    process.env.MOCK_SERPAPI = "false";
    process.env.SERPAPI_KEY = "server-only-test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as Response);

    const result = await call().nammaNav.recommend({
      text: "Find an open pharmacy near Anna Nagar",
      broadLocation: "Anna Nagar, Chennai",
      mustHave: [],
      accessibility: [],
      openNow: true,
      currentCheck: true,
      privacyMode: true,
    });

    expect(result.providerError).toBe("PROVIDER_QUOTA");
    expect(result.telemetry.quotaWarning).toBe(true);
    expect(result.telemetry.requestsUsed).toBeLessThanOrEqual(result.telemetry.maxRequestsPerWorkflow);
  }, 15000);
});
