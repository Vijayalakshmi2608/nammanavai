import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("NammaNav recommendation intelligence", () => {
  it("returns constraints, graph, freshness, replay, mission, and no-match fields in mock mode", async () => {
    const previousMode = process.env.MOCK_SERPAPI;
    process.env.MOCK_SERPAPI = "true";
    const caller = appRouter.createCaller({ req: {}, res: {}, user: null } as any);
    const result = await caller.nammaNav.recommend({
      text: "Find a quiet place to study near Anna Nagar",
      broadLocation: "Anna Nagar, Chennai",
      budget: 300,
      maxDistance: 5,
      mustHave: ["Wi-Fi"],
      accessibility: [],
      openNow: true,
      currentCheck: true,
      privacyMode: true,
    });
    process.env.MOCK_SERPAPI = previousMode;

    expect(result.mode).toBe("mock");
    expect(result.constraints).toContain("Under ₹300");
    expect(result.evidenceGraph.length).toBeGreaterThan(0);
    expect(result.freshnessRadar.length).toBeGreaterThan(0);
    expect(result.replay).toContain("Privacy sanitization");
    expect(result.mission.engines.map((engine) => engine.engine)).toContain("google_news");
    expect(result.privacy.rawRequestStored).toBe(false);
  });
});
