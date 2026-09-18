import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const call = () => appRouter.createCaller({ req: {}, res: {}, user: null } as any);

afterEach(() => { process.env.MOCK_SERPAPI = "true"; });

describe("hackathon judging quality", () => {
  it("gives every evidence claim a stable identity and explicit polarity", async () => {
    const result = await call().nammaNav.recommend({ text: "Find a quiet study place near Anna Nagar with Wi-Fi", broadLocation: "Anna Nagar, Chennai", mustHave: ["Wi-Fi"], accessibility: [], openNow: true, currentCheck: false, privacyMode: true });
    expect(result.evidenceGraph.length).toBeGreaterThan(0);
    expect(new Set(result.evidenceGraph.map((edge: any) => edge.claimId)).size).toBe(result.evidenceGraph.length);
    expect(result.evidenceGraph.every((edge: any) => ["supports", "challenges", "conflicting", "stale", "unknown"].includes(edge.polarity))).toBe(true);
    expect(result.evidenceGraph.every((edge: any) => typeof edge.scoreImpact === "number" && typeof edge.retrievedAt === "string")).toBe(true);
  }, 15000);

  it("shows the dedicated challenge step and bounded mission metrics", async () => {
    const result = await call().nammaNav.recommend({ text: "Find a quiet study place near Anna Nagar with Wi-Fi and charging", broadLocation: "Anna Nagar, Chennai", mustHave: ["Wi-Fi", "charging points"], accessibility: [], openNow: true, currentCheck: false, privacyMode: true });
    expect(result.replay).toContain("Challenge search");
    expect(result.mission.requestCount).toBeLessThanOrEqual(5);
    expect(result.mission.claimsCreated).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty("initialRecommendation");
    expect(result).toHaveProperty("scoreChange");
    expect(result.dossier).toHaveProperty("challengeResults");
  });
});
