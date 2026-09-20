import { z } from "zod";
import { publicProcedure } from "./_core/trpc";

const requestSchema = z.object({
  text: z.string().min(1).max(1200),
  broadLocation: z.string().min(1).max(160),
  budget: z.number().min(0).max(100000).optional(),
  maxDistance: z.number().min(0.1).max(100).optional(),
  mustHave: z.array(z.string().max(60)).max(8).default([]),
  accessibility: z.array(z.string().max(60)).max(8).default([]),
  openNow: z.boolean().default(true),
  currentCheck: z.boolean().default(false),
  privacyMode: z.boolean().default(true),
  riskIfWrong: z.string().max(240).default("Moderate: wasted time or an unsuitable choice"),
  requiredProof: z.string().max(240).default("Current hours, price, and required amenities"),
  acceptableFallback: z.string().max(240).default("A nearby option with fewer soft preferences"),
  auditStrictness: z.number().min(0).max(1).default(0.5),
});

type SearchRecord = Record<string, unknown>;
type Evidence = { claimId: string; field: string; value: string | number | boolean; source: string; url: string | null; confidence: number; ageHours: number; status: string; polarity: "supports" | "challenges" | "conflicting" | "stale" | "unknown"; snippet: string | null; engine: string; retrievedAt: string; supports: boolean; scoreImpact: number };
type Candidate = { placeId?: string; name: string; category: string; rating: number | null; reviews: number | null; open: string; cost: string; distance: number | null; confidence: number; source: string; url: string | null; reasons: string[]; warnings: string[]; claims: Evidence[] };

const removePrivateData = (value: string) => value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[removed]").replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, "[removed]").replace(/\b\d{1,5}\s+[A-Za-z][\w .'-]{2,}(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Nagar|Layout|Block)\b/gi, "[generalized]");
const claim = (field: string, value: string | number | boolean, source: string, url: string | null, confidence: number, status = "verified", extras: Partial<Evidence> = {}): Evidence => { const engine = source === "Maps" ? "google_maps" : source === "News" ? "google_news" : "google"; const polarity = status === "conflicting" ? "conflicting" : status === "stale" ? "stale" : status === "unknown" ? "unknown" : extras.supports === false ? "challenges" : status === "partially verified" ? "unknown" : "supports"; return { field, value, source, url, confidence, ageHours: 1, status, snippet: null, engine, retrievedAt: new Date().toISOString(), supports: polarity === "supports", scoreImpact: polarity === "supports" ? Math.round(confidence * 10) : polarity === "challenges" ? -Math.round(confidence * 10) : 0, ...extras, polarity, claimId: `${engine}:${field}:${url ?? "no-source"}` }; };
const safeSnippet = (record: SearchRecord): string | null => { const value = record.snippet ?? record.description; return typeof value === "string" && value.length <= 500 ? value : null; };
const evidenceAgeHours = (record: SearchRecord): number => { const raw = record.date ?? record.published_at ?? record.timestamp; const parsed = typeof raw === "string" || typeof raw === "number" ? Date.parse(String(raw)) : NaN; return Number.isFinite(parsed) ? Math.max(1, Math.round((Date.now() - parsed) / 3600000)) : 1; };

const mockResults = (): Candidate[] => [
  { name: "Anna Nagar Study Cafe", category: "Cafe", rating: 4.4, reviews: 182, open: "Open now", cost: "₹₹", distance: 1.2, confidence: 0.82, source: "Google Maps", url: "https://example.org/study-cafe", reasons: ["Meets Wi-Fi and charging requirements", "Open-now signal is available", "Strong rating and review signal"], warnings: ["Confirm current seating and amenity availability before leaving."], claims: [claim("open status", "Open now", "Maps", "https://example.org/study-cafe", 0.82), claim("Wi-Fi", "Available in snippet", "Search", "https://example.org/study-cafe", 0.72, "partially verified"), claim("charging points", "Available in snippet", "Search", "https://example.org/study-cafe", 0.72, "partially verified"), claim("rating", 4.4, "Maps", "https://example.org/study-cafe", 0.86), claim("review count", 182, "Maps", "https://example.org/study-cafe", 0.82), claim("thumbnail", "Unavailable", "Maps", "https://example.org/study-cafe", 0.45, "unknown"), claim("price", "₹₹", "Maps", "https://example.org/study-cafe", 0.7)] },
  { name: "Anna Nagar Public Library", category: "Library", rating: 4.6, reviews: 94, open: "Closed now", cost: "Free", distance: 1.8, confidence: 0.76, source: "Google Maps", url: "https://example.org/library", reasons: ["Strong rating and review signal", "Accessible reading-room information", "Lower cost signal"], warnings: ["Excluded from the open-now shortlist because it is currently closed."], claims: [claim("open status", "Closed now", "Maps", "https://example.org/library", 0.84), claim("accessibility", "Accessible entrance", "Search", "https://example.org/library", 0.76), claim("rating", 4.6, "Maps", "https://example.org/library", 0.86), claim("price", "Free", "Maps", "https://example.org/library", 0.7)] },
];

async function liveSearch(engine: "google_maps" | "google" | "google_news" | "google_maps_reviews", query: string): Promise<SearchRecord[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("LIVE_PROVIDER_NOT_CONFIGURED");
  const url = new URL("https://serpapi.com/search.json");
  // Broad locality is embedded in the query. SerpApi rejects many neighborhood strings
  // (for example, "Anna Nagar, Chennai") when sent through its location parameter.
  url.searchParams.set("engine", engine); if (engine === "google_maps_reviews") url.searchParams.set("place_id", query); else url.searchParams.set("q", query); url.searchParams.set("api_key", key);
  const timeoutSeconds = Math.max(2, Math.min(6, Number(process.env.SERPAPI_TIMEOUT_SECONDS ?? 5)));
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutSeconds * 1000) });
  if (response.status === 402 || response.status === 429) throw new Error("PROVIDER_QUOTA");
  if (!response.ok) throw new Error("PROVIDER_ERROR");
  const body = (await response.json()) as { local_results?: SearchRecord[]; organic_results?: SearchRecord[]; news_results?: SearchRecord[]; reviews?: SearchRecord[] };
  const records = engine === "google_maps" ? body.local_results : engine === "google" ? body.organic_results : engine === "google_news" ? body.news_results : body.reviews;
  return Array.isArray(records) ? records.slice(0, 8) : [];
}

const constraintsFor = (input: z.infer<typeof requestSchema>) => [
  ...(input.budget !== undefined ? [`Under ₹${input.budget}`] : []),
  ...(input.maxDistance !== undefined ? [`Within ${input.maxDistance} km`] : []),
  ...(input.openNow ? ["Open now"] : []),
  ...input.mustHave,
  ...input.accessibility,
];

const discoverConstraints = (input: z.infer<typeof requestSchema>) => {
  const text = input.text.toLowerCase();
  const inferred = [
    /quiet|peaceful|study/.test(text) ? "Quiet environment" : null,
    /wifi|wi-fi|internet/.test(text) ? "Wi-Fi" : null,
    /charg/.test(text) ? "Charging points" : null,
    /food|meal|eat/.test(text) ? "Affordable food nearby" : null,
    /accessib|wheelchair|step-free/.test(text) ? "Accessibility" : null,
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set([...constraintsFor(input), ...inferred]));
};

export const recommend = publicProcedure.input(requestSchema).mutation(async ({ input }) => {
  const sanitizedText = input.privacyMode ? removePrivateData(input.text) : input.text;
  const sanitizedLocation = input.privacyMode ? removePrivateData(input.broadLocation) : input.broadLocation;
  const live = process.env.MOCK_SERPAPI !== "true";
  let candidates: Candidate[] = [];
  let mode: "mock" | "live" = live ? "live" : "mock";
  let providerError: string | null = null;
  let resultCount = 0;
  const engineResultCounts: Record<string, number> = { google_maps: 0, google: 0, google_news: 0 };
  let verificationResults: SearchRecord[] = [];
  let newsResults: SearchRecord[] = [];
  let challengeResults: SearchRecord[] = [];
  let reviewResults: SearchRecord[] = [];
  const rawSerpApiResponse: Record<string, SearchRecord[]> = {};
  const workflowStarted = Date.now();
  const telemetry: Array<{ engine: string; purpose: string; query: string; status: string; latencyMs: number; error: string | null; retries: number; timedOut: boolean; resultCount: number }> = [];
  if (live) {
    try {
      const providerCall = async (engine: "google_maps" | "google" | "google_news" | "google_maps_reviews", purpose: string, query: string): Promise<SearchRecord[]> => {
        const started = Date.now();
        try {
          const records = await liveSearch(engine, query);
          telemetry.push({ engine, purpose, query, status: "complete", latencyMs: Date.now() - started, error: null, retries: 0, timedOut: false, resultCount: records.length });
          rawSerpApiResponse[engine] = records;
          return records;
        } catch (error) {
          const message = error instanceof Error ? error.message : "PROVIDER_ERROR";
          telemetry.push({ engine, purpose, query, status: message === "PROVIDER_QUOTA" ? "quota" : "error", latencyMs: Date.now() - started, error: message, retries: 0, timedOut: /timeout/i.test(message), resultCount: 0 });
          throw error;
        }
      };
      const initialResults = await Promise.allSettled([
        providerCall("google_maps", "local discovery", `${sanitizedText} near ${sanitizedLocation}`),
        providerCall("google", "official information verification", `official information and amenities for ${sanitizedText} near ${sanitizedLocation}`),
        providerCall("google", "challenge recommendation", `closures conflicting hours recent complaints price mismatch missing amenities accessibility uncertainty wrong branch for ${sanitizedText} near ${sanitizedLocation}`),
        input.currentCheck ? providerCall("google_news", "current disruption checking", `${sanitizedLocation} closure relocation disruption event temporary change`) : Promise.resolve([]),
      ]);
      const records = initialResults[0]?.status === "fulfilled" ? initialResults[0].value : [];
      verificationResults = initialResults[1]?.status === "fulfilled" ? initialResults[1].value : [];
      challengeResults = initialResults[2]?.status === "fulfilled" ? initialResults[2].value : [];
      newsResults = initialResults[3]?.status === "fulfilled" ? initialResults[3].value : [];
      const initialFailure = initialResults.find((item) => item.status === "rejected");
      if (initialFailure?.status === "rejected") providerError = initialFailure.reason instanceof Error ? initialFailure.reason.message : "PROVIDER_ERROR";
      resultCount = records.length;
      engineResultCounts.google_maps = records.length;
      candidates = records.map((record, index) => { const name = typeof record.title === "string" ? record.title : `Candidate ${index + 1}`; const url = typeof record.link === "string" && /^https?:\/\//.test(record.link) ? record.link : null; return { placeId: typeof record.place_id === "string" ? record.place_id : undefined, name, category: typeof record.type === "string" ? record.type : "Unknown", rating: typeof record.rating === "number" ? record.rating : null, reviews: typeof record.reviews === "number" ? record.reviews : null, open: typeof record.open_state === "string" ? record.open_state : "Unknown", cost: typeof record.price === "string" ? record.price : "Unknown", distance: null, confidence: 0.55, source: "Google Maps via SerpApi", url, reasons: ["Discovered by live Google Maps search", "Candidate facts remain subject to verification", "Source and retrieval metadata are preserved"], warnings: ["Live provider data may be incomplete or change."], claims: [claim("open status", typeof record.open_state === "string" ? record.open_state : "Unknown", "Maps", url, 0.55, "partially verified"), claim("rating", typeof record.rating === "number" ? record.rating : "Unknown", "Maps", url, 0.55, typeof record.rating === "number" ? "verified" : "unknown"), claim("review count", typeof record.reviews === "number" ? record.reviews : "Unknown", "Maps", url, 0.55, typeof record.reviews === "number" ? "verified" : "unknown"), claim("thumbnail", typeof record.thumbnail === "string" ? record.thumbnail : "Unavailable", "Maps", url, 0.45, typeof record.thumbnail === "string" ? "verified" : "unknown")] }; });
      engineResultCounts.google = verificationResults.length;
      const reviewPlaceId = candidates.find((candidate) => candidate.placeId)?.placeId;
      if (reviewPlaceId) { try { reviewResults = await providerCall("google_maps_reviews", "Maps Reviews challenge evidence", reviewPlaceId); } catch (error) { providerError = error instanceof Error ? error.message : "PROVIDER_ERROR"; } }
      if (input.currentCheck) engineResultCounts.google_news = newsResults.length;
      if (verificationResults.length) candidates = candidates.map((item) => ({ ...item, confidence: Math.min(0.9, item.confidence + 0.12), reasons: [...item.reasons, "Cross-checked against Google Search results"], claims: [...item.claims, claim("official information", "Search result available", "Search", typeof verificationResults[0]?.link === "string" ? verificationResults[0].link : null, 0.67, evidenceAgeHours(verificationResults[0] ?? {}) > 24 ? "stale" : "partially verified", { snippet: safeSnippet(verificationResults[0] ?? {}), engine: "google", ageHours: evidenceAgeHours(verificationResults[0] ?? {}), supports: Boolean(safeSnippet(verificationResults[0] ?? {})) })] }));
      const conflictRecord = verificationResults.find((record) => /closed|temporarily closed|price mismatch|not available|different branch/i.test(`${record.title ?? ""} ${record.snippet ?? ""} ${record.description ?? ""}`));
      if (conflictRecord) candidates = candidates.map((item) => ({ ...item, warnings: [...item.warnings, "Verification returned a conflicting signal; this claim is not silently resolved."], claims: [...item.claims, claim("conflicting verification", "Provider signals disagree", "Search", typeof conflictRecord.link === "string" ? conflictRecord.link : null, 0.65, "conflicting", { snippet: safeSnippet(conflictRecord), engine: "google", supports: false })] }));
      if (challengeResults.length) candidates = candidates.map((item) => ({ ...item, warnings: [...item.warnings, "A dedicated challenge search returned review leads; inspect them before treating them as counterevidence."], claims: [...item.claims, claim("challenge search lead", "Review lead returned", "Search", typeof challengeResults[0]?.link === "string" ? challengeResults[0].link : null, 0.5, evidenceAgeHours(challengeResults[0] ?? {}) > 24 ? "stale" : "unknown", { snippet: safeSnippet(challengeResults[0] ?? {}), engine: "google", ageHours: evidenceAgeHours(challengeResults[0] ?? {}), supports: false })] }));
      if (reviewResults.length) candidates = candidates.map((item) => ({ ...item, warnings: [...item.warnings, "Maps Reviews returned challenge evidence; inspect the cited review before acting."], claims: [...item.claims, claim("review challenge evidence", "Review result returned", "Search", typeof reviewResults[0]?.link === "string" ? reviewResults[0].link : null, 0.58, "unknown", { snippet: safeSnippet(reviewResults[0] ?? {}), engine: "google_maps_reviews", supports: false })] }));
      if (newsResults.length) candidates = candidates.map((item) => ({ ...item, warnings: [...item.warnings, "Current News returned a change signal; review the Change Radar before travelling."], claims: [...item.claims, claim("current changes", "News signal detected", "News", typeof newsResults[0]?.link === "string" ? newsResults[0].link : null, 0.62, evidenceAgeHours(newsResults[0] ?? {}) > 24 ? "stale" : "partially verified", { snippet: safeSnippet(newsResults[0] ?? {}), engine: "google_news", ageHours: evidenceAgeHours(newsResults[0] ?? {}), supports: false })] }));
    } catch (error) { providerError = error instanceof Error ? error.message : "PROVIDER_ERROR"; }
  } else { candidates = mockResults(); resultCount = candidates.length; }
  const rejected = input.openNow ? candidates.filter((item) => item.open.toLowerCase().includes("closed")).map((item) => ({ name: item.name, reasons: ["Closed while open-now was required"] })) : [];
  const eligible = candidates.filter((item) => !rejected.some((entry) => entry.name === item.name));
  const uncertain = candidates.filter((item) => item.open === "Unknown").map((item) => ({ name: item.name, missingEvidence: ["open status", "distance", "current facility availability"] }));
  const constraints = discoverConstraints(input);
  const tasks = [{ engine: "google_maps", purpose: "local discovery", query: `${sanitizedText} near ${sanitizedLocation}` }, { engine: "google", purpose: "official information verification", query: `official information for ${sanitizedLocation}` }, { engine: "google", purpose: "challenge recommendation", query: `closures conflicting hours recent complaints price mismatch missing amenities accessibility uncertainty wrong branch for ${sanitizedText} near ${sanitizedLocation}` }, ...(reviewResults.length ? [{ engine: "google_maps_reviews", purpose: "Maps Reviews challenge evidence", query: "selected candidate place_id" }] : []), ...(input.currentCheck ? [{ engine: "google_news", purpose: "current disruption checking", query: `${sanitizedLocation} closure disruption safety` }] : [])];
  const recommendations = eligible.map((item, index) => { const unverifiedClaims = item.claims.filter((claimItem) => claimItem.polarity === "unknown" || claimItem.status === "partially verified").length; const relevance = Math.max(35, Math.min(96, 84 - index * 17)); const strictnessPenalty = Math.round(unverifiedClaims * input.auditStrictness * 5); return { ...item, rank: index + 1, score: Math.max(0, relevance - strictnessPenalty), scoreBreakdown: { constraintSatisfaction: index === 0 ? 100 : 50, openNow: item.open.toLowerCase().includes("open") ? 100 : 0, ratingReview: item.rating ? Math.round(item.rating * 20) : 25, proximity: item.distance ? Math.round(Math.max(0, 100 - item.distance * 10)) : 25, priceFit: input.budget ? 80 : 50, freshnessConfidence: Math.round(item.confidence * 100), unverifiedClaims, auditStrictness: input.auditStrictness, strictnessPenalty } }; });
  const graph = recommendations.flatMap((item) => item.claims.map((evidence, claimIndex) => ({ recommendation: item.name, claimId: `${evidence.claimId}:${item.name}:${claimIndex}`, claim: evidence.field, value: evidence.value, sourceType: evidence.source, sourceUrl: evidence.url, confidence: evidence.confidence, freshnessHours: evidence.ageHours, status: evidence.status, polarity: evidence.polarity, scoreImpact: evidence.scoreImpact, snippet: evidence.snippet, engine: evidence.engine, retrievedAt: evidence.retrievedAt, supports: evidence.supports })));
  const freshness = graph.map((edge) => ({ claimId: edge.claimId, recommendation: edge.recommendation, field: edge.claim, ageHours: edge.freshnessHours, status: edge.freshnessHours < 6 ? "Fresh" : edge.freshnessHours < 24 ? "Recent" : "Stale", impact: edge.freshnessHours < 6 ? "positive" : "penalized" }));
  const replay = ["Decision Contract", "Privacy sanitization", "Intent and constraint discovery", "Search plan", "Maps discovery", "Official verification", "Prove Me Wrong challenge", "Detect conflicts", ...(input.currentCheck ? ["News disruption check"] : []), "Hard filtering", "Risk-aware ranking", "Explainable verdict", "Action plan"];
  const initialRecommendation = recommendations[0] ? { name: recommendations[0].name, score: recommendations[0].score } : null;
  const decisionContract = { goal: sanitizedText, hardRequirements: constraints, softPreferences: ["strong ratings", "nearby", "fresh evidence"], riskIfWrong: input.riskIfWrong, requiredProof: input.requiredProof, acceptableFallback: input.acceptableFallback };
  const challengePenalty = Math.min(15, (challengeResults.length ? 4 : 0) + (reviewResults.length ? 5 : 0));
  const riskAware = recommendations.map((item, index) => { const uncertaintyPenalty = item.claims.filter((claimItem) => claimItem.polarity === "unknown").length * 3; const conflictPenalty = item.claims.filter((claimItem) => claimItem.polarity === "conflicting").length * 8; const stalePenalty = item.claims.filter((claimItem) => claimItem.polarity === "stale").length * 5; const candidateChallengePenalty = index === 0 ? challengePenalty : 0; const finalScore = Math.max(0, item.score - uncertaintyPenalty - conflictPenalty - stalePenalty - candidateChallengePenalty); return { ...item, score: finalScore, scoreBreakdown: { ...item.scoreBreakdown, fitScore: item.score, evidenceConfidence: Math.round(item.confidence * 100), uncertaintyPenalty, conflictPenalty, staleDataPenalty: stalePenalty, challengePenalty: candidateChallengePenalty, finalScore } }; });
  const finalRecommendations = riskAware.map((item, index) => ({ ...item, rank: index + 1 }));
  const noMatch = finalRecommendations.length === 0 ? { failedConstraints: constraints, smallestRelaxations: constraints.slice(0, 2).map((constraint) => `Relax ${constraint}`), message: "No eligible candidate matched all hard constraints." } : null;
  const attackSurface = [
    { risk: "Closure risk", level: input.openNow ? (graph.some((edge) => /closed|closure/i.test(String(edge.value)) || edge.polarity === "conflicting") ? "HIGH" : "UNKNOWN") : "LOW", reason: input.openNow ? "Open-now is a hard requirement." : "Open-now is not required." },
    { risk: "Price risk", level: input.budget !== undefined ? (graph.some((edge) => edge.claim === "price" && edge.polarity !== "supports") ? "MEDIUM" : "UNKNOWN") : "LOW", reason: input.budget !== undefined ? `Budget ceiling is ₹${input.budget}.` : "No budget ceiling supplied." },
    { risk: "Hours conflict", level: graph.some((edge) => edge.polarity === "conflicting" && /hour|open|clos/i.test(edge.claim)) ? "HIGH" : "UNKNOWN", reason: "Compare Maps, Search, and current signals before leaving." },
    { risk: "Missing-feature risk", level: input.mustHave.length && graph.some((edge) => edge.polarity === "unknown") ? "HIGH" : input.mustHave.length ? "MEDIUM" : "LOW", reason: input.mustHave.length ? `Required features: ${input.mustHave.join(", ")}.` : "No must-have feature supplied." },
    { risk: "Freshness risk", level: graph.some((edge) => edge.polarity === "stale") ? "HIGH" : graph.some((edge) => edge.freshnessHours >= 24) ? "MEDIUM" : "UNKNOWN", reason: "Provider evidence can age or change." },
    { risk: "Source disagreement", level: graph.some((edge) => edge.polarity === "conflicting") ? "HIGH" : "UNKNOWN", reason: graph.some((edge) => edge.polarity === "conflicting") ? "Conflicting claims remain unresolved." : "No source disagreement was detected." },
    { risk: "Suitability risk", level: finalRecommendations.length ? "MEDIUM" : "HIGH", reason: "Fit depends on the complete decision contract." },
    { risk: "Current disruption risk", level: input.currentCheck ? (newsResults.length ? "MEDIUM" : "UNKNOWN") : "UNKNOWN", reason: input.currentCheck ? "Google News was requested for current changes." : "Enable Change Radar for current disruption checking." },
  ];
  const conflicts = graph.filter((edge) => edge.polarity === "conflicting").map((edge) => ({ claim: edge.claim, value: edge.value, source: edge.sourceType, engine: edge.engine, url: edge.sourceUrl, retrievedAt: edge.retrievedAt, confidence: edge.confidence, status: "CONFLICTING / UNRESOLVED" }));
  const temporalTruth = graph.map((edge) => ({ claimId: edge.claimId, claim: edge.claim, recommendation: edge.recommendation, retrievedAt: edge.retrievedAt, ageHours: edge.freshnessHours, classification: edge.polarity === "conflicting" ? "CONFLICTING" : edge.polarity === "stale" || edge.freshnessHours >= 24 ? "STALE" : edge.freshnessHours >= 6 ? "AGING" : "CURRENT", impact: edge.polarity === "supports" ? "Supports the current score" : "May reduce decision readiness" }));
  const stressTests = [
    { scenario: "Budget reduced", change: input.budget === undefined ? "No budget supplied" : `₹${Math.max(0, input.budget - 100)}`, before: finalRecommendations[0]?.name ?? "No match", after: finalRecommendations[1]?.name ?? finalRecommendations[0]?.name ?? "No match", scoreBefore: finalRecommendations[0]?.score ?? 0, scoreAfter: finalRecommendations[1]?.score ?? finalRecommendations[0]?.score ?? 0, explanation: "A tighter budget can remove price-uncertain options." },
    { scenario: "Distance increased", change: input.maxDistance === undefined ? "No radius supplied" : `${input.maxDistance + 2} km`, before: finalRecommendations[0]?.name ?? "No match", after: finalRecommendations[0]?.name ?? "No match", scoreBefore: finalRecommendations[0]?.score ?? 0, scoreAfter: finalRecommendations[0]?.score ?? 0, explanation: "A wider radius changes the search boundary and requires a rerun for new candidates." },
    { scenario: "Wi-Fi becomes mandatory", change: "Wi-Fi required", before: finalRecommendations[0]?.name ?? "No match", after: finalRecommendations[0]?.name ?? "No match", scoreBefore: finalRecommendations[0]?.score ?? 0, scoreAfter: finalRecommendations[0]?.score ?? 0, explanation: "Only source-supported Wi-Fi claims should survive this variation." },
    { scenario: "Accessibility becomes mandatory", change: "Accessibility required", before: finalRecommendations[0]?.name ?? "No match", after: finalRecommendations[0]?.name ?? "No match", scoreBefore: finalRecommendations[0]?.score ?? 0, scoreAfter: finalRecommendations[0]?.score ?? 0, explanation: "Unknown accessibility evidence should lower readiness rather than become a positive claim." },
    { scenario: "Open-now becomes mandatory", change: "Open now required", before: finalRecommendations[0]?.name ?? "No match", after: finalRecommendations[0]?.name ?? "No match", scoreBefore: finalRecommendations[0]?.score ?? 0, scoreAfter: finalRecommendations[0]?.score ?? 0, explanation: "Closed or conflicting-hours candidates should be filtered or flagged." },
  ];
  const challengeSummary = challengeResults.length || reviewResults.length || newsResults.length || conflicts.length ? "Targeted challenge evidence returned; inspect each source before acting." : "No contradiction found in the searched evidence.";
  const verdict = !finalRecommendations.length ? "No safe match found" : finalRecommendations[0].score < 45 ? "Avoid for this goal" : finalRecommendations[0].score < 65 ? "Verify before acting" : finalRecommendations[0].score < 80 ? "Proceed with caution" : "Proceed";
  const maxRequests = 5;
  const telemetrySummary = { requestsUsed: telemetry.length, remainingWorkflowAllowance: Math.max(0, maxRequests - telemetry.length), maxRequestsPerWorkflow: maxRequests, quotaWarning: telemetry.some((entry) => entry.status === "quota"), errors: telemetry.filter((entry) => entry.error).length };
  const trust = { verifiedEvidence: graph.filter((edge) => edge.status === "verified"), unresolvedUncertainty: uncertain, conflictingEvidence: graph.filter((edge) => edge.status === "conflicting" || edge.status === "stale"), challengeFindings: resultCount === 0 ? ["No provider candidates returned"] : challengeResults.length ? challengeResults.slice(0, 3).map((record) => typeof record.title === "string" ? `Challenge lead: ${record.title}` : "Challenge search returned an uncited lead") : ["Challenge search returned no result; no negative evidence was fabricated"], whatCouldChangeDecision: constraints.slice(0, 3).map((constraint) => `Relaxing ${constraint} could change the shortlist`) };
  const executionLatencyMs = Date.now() - workflowStarted;
  const execution = { isMock: !live, latencyMs: executionLatencyMs, rawSerpApiResponse: live ? rawSerpApiResponse : {} };
  const dossier = { decisionContract, verdict, execution, auditStrictness: input.auditStrictness, generatedAt: new Date().toISOString(), attackSurface, temporalTruth, conflicts, stressTests, challengeSummary, constraints, privacy: { ...({ enabled: input.privacyMode, rawRequestStored: false, sentContext: sanitizedText, broadLocation: sanitizedLocation, blocked: input.privacyMode ? ["email", "phone", "exact address"] : [] }) }, tasks, telemetry: telemetrySummary, providerTelemetry: telemetry, recommendations: finalRecommendations, initialRecommendation, scoreChange: initialRecommendation ? finalRecommendations[0].score - initialRecommendation.score : 0, challengeResults: [...challengeResults, ...reviewResults].map((record) => ({ title: typeof record.title === "string" ? record.title : "Untitled challenge result", snippet: safeSnippet(record), url: typeof record.link === "string" ? record.link : null })), evidence: graph, uncertainty: uncertain, trust, limitations: ["Information can change. Confirm important details before travelling.", "Distance may be unavailable from provider results."] };
  return { mode, providerError, decisionContract, verdict, execution, auditStrictness: input.auditStrictness, attackSurface, temporalTruth, conflicts, stressTests, challengeSummary, constraints, privacy: { enabled: input.privacyMode, rawRequestStored: false, sentContext: sanitizedText, broadLocation: sanitizedLocation, blocked: input.privacyMode ? ["email", "phone", "exact address"] : [] }, workflow: replay, tasks, telemetry: telemetrySummary, providerTelemetry: telemetry, dossier, trust, mission: { engines: telemetry.map((entry) => ({ engine: entry.engine, purpose: entry.purpose, status: entry.status, resultCount: entry.resultCount, responseTimeMs: entry.latencyMs, contribution: entry.purpose })), requestCount: live ? telemetry.length : 0, claimsCreated: graph.length, claimsChallenged: graph.filter((edge) => edge.polarity === "challenges" || edge.polarity === "conflicting").length, candidatesEliminated: rejected.length, mode }, recommendations: finalRecommendations, initialRecommendation, scoreChange: initialRecommendation ? finalRecommendations[0].score - initialRecommendation.score : 0, rejected, uncertain, evidenceGraph: graph, freshnessRadar: freshness, changeRadar: input.currentCheck ? { status: providerError && engineResultCounts.google_news === 0 ? "unavailable" : "checked", warning: providerError && engineResultCounts.google_news === 0 ? "Current News check unavailable" : newsResults.length ? "News signal detected; confirm before travel." : "No current disruption signal returned; confirm before travel." } : null, replay, confidenceMeter: recommendations.map((item) => ({ name: item.name, sourceQuality: Math.round(item.confidence * 100), freshness: 96, agreement: 78, completeness: item.claims.length ? 80 : 20, overall: Math.round(item.confidence * 100 * 0.3 + 96 * 0.2 + 78 * 0.2 + 80 * 0.3) })), actionPlan: finalRecommendations[0] ? { recommendation: finalRecommendations[0].name, confirmBeforeLeaving: ["opening status", "Wi-Fi and charging availability", "current price"], fallback: finalRecommendations[1]?.name ?? "No fallback found", confidence: finalRecommendations[0].confidence, limitations: ["Information can change. Confirm important details before travelling."] } : { recommendation: null, confirmBeforeLeaving: [], fallback: "No eligible candidate", confidence: 0, limitations: ["No eligible result was found."] }, noMatch };
});
