const endpoint = process.env.NAMMANAV_AUDIT_URL ?? "http://127.0.0.1:3000/api/trpc/nammaNav.recommend?batch=1";
const payload = {
  0: {
    json: {
      text: "Find a quiet place to study near Anna Nagar, Chennai, open now, under ₹300, with Wi-Fi and charging points",
      broadLocation: "Anna Nagar, Chennai",
      budget: 300,
      maxDistance: 5,
      mustHave: ["Wi-Fi", "charging points"],
      accessibility: [],
      openNow: true,
      currentCheck: true,
      privacyMode: true,
      riskIfWrong: "Moderate: wasted time",
      requiredProof: "Current hours, price, and required amenities",
      acceptableFallback: "A nearby option with fewer soft preferences",
      auditStrictness: 0.5,
    },
  },
};

const started = Date.now();
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});
const outer = await response.json();
const result = outer?.[0]?.result?.data?.json;
const telemetry = Array.isArray(result?.providerTelemetry) ? result.providerTelemetry : [];
const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
const evidence = Array.isArray(result?.evidenceGraph) ? result.evidenceGraph : [];
const freshness = Array.isArray(result?.freshnessRadar) ? result.freshnessRadar : [];
const raw = result?.execution?.rawSerpApiResponse ?? {};
const candidateUrls = recommendations.flatMap((candidate) => [candidate.url, ...(candidate.claims ?? []).map((claim) => claim.url)]).filter(Boolean);
const hasMockUrl = candidateUrls.some((url) => String(url).includes("example.org"));
const requiredEngines = ["google_maps", "google"];
const requiredEngineChecks = Object.fromEntries(requiredEngines.map((engine) => [engine, telemetry.some((item) => item.engine === engine)]));
const checks = {
  httpOk: response.ok,
  liveMode: result?.mode === "live",
  notMockExecution: result?.execution?.isMock === false,
  serverDidNotStoreRawRequest: result?.privacy?.rawRequestStored === false,
  mapsAndSearchCalled: requiredEngines.every((engine) => requiredEngineChecks[engine]),
  currentNewsCalled: telemetry.some((item) => item.engine === "google_news"),
  reviewsCalledOrExplicitlySkipped: telemetry.some((item) => item.engine === "google_maps_reviews") || !recommendations.some((candidate) => candidate.placeId),
  telemetryHasLatencyAndCounts: telemetry.every((item) => typeof item.latencyMs === "number" && typeof item.resultCount === "number"),
  mapsPayloadCaptured: Array.isArray(raw.google_maps),
  candidatesMapped: recommendations.length > 0,
  claimsMapped: evidence.length > 0 && recommendations.some((candidate) => Array.isArray(candidate.claims) && candidate.claims.length > 0),
  sourceLinksPreserved: evidence.some((edge) => typeof edge.sourceUrl === "string" && /^https?:\/\//.test(edge.sourceUrl)),
  freshnessMapped: freshness.length > 0,
  challengeMapped: Boolean(result?.challengeSummary) && (Array.isArray(result?.challengeResults) || telemetry.some((item) => item.purpose?.includes("challenge"))),
  rankingMapped: recommendations.every((candidate) => typeof candidate.score === "number" && typeof candidate.rank === "number"),
  finalVerdictMapped: typeof result?.verdict === "string" && typeof result?.actionPlan?.recommendation === "string",
  noMockCandidates: !hasMockUrl,
};
const failed = Object.entries(checks).filter(([, value]) => !value).map(([name]) => name);
console.log(JSON.stringify({
  endpoint,
  httpStatus: response.status,
  elapsedMs: Date.now() - started,
  mode: result?.mode,
  providerError: result?.providerError ?? null,
  verdict: result?.verdict ?? null,
  actionRecommendation: result?.actionPlan?.recommendation ?? null,
  requestCount: result?.mission?.requestCount ?? null,
  telemetry: telemetry.map((item) => ({ engine: item.engine, purpose: item.purpose, status: item.status, latencyMs: item.latencyMs, resultCount: item.resultCount, error: item.error })),
  candidateCount: recommendations.length,
  evidenceCount: evidence.length,
  freshnessCount: freshness.length,
  rawEngines: Object.keys(raw),
  checks,
  failed,
  verdictSummary: failed.length === 0 ? "WORKING: live provider data reached the final decision pipeline" : "DEGRADED: one or more live pipeline checks failed",
}, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
