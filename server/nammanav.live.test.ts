import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("live NammaNav workflow", () => {
  it("returns a live recommendation payload with provider mission data", async () => {
    const previousMode = process.env.MOCK_SERPAPI;
    process.env.MOCK_SERPAPI = "false";
    const caller = appRouter.createCaller({ req: {}, res: {}, user: null } as any);
    const result = await caller.nammaNav.recommend({
      text: "Find a quiet study place near Anna Nagar Chennai under 300 rupees with Wi-Fi",
      broadLocation: "Anna Nagar, Chennai",
      budget: 300,
      maxDistance: 5,
      mustHave: ["Wi-Fi"],
      accessibility: [],
      openNow: true,
      currentCheck: false,
      privacyMode: true,
    });
    process.env.MOCK_SERPAPI = previousMode;

    expect(result.mode).toBe("live");
    expect(result.mission.engines.find((engine) => engine.engine === "google_maps")?.status).toBe("complete");
    expect(result.mission.engines.find((engine) => engine.engine === "google_maps")?.resultCount).toBeGreaterThan(0);
    expect(result.privacy.rawRequestStored).toBe(false);
  }, 30000);
});
