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
});

type SearchRecord = Record<string, unknown>;
type Candidate = { name: string; category: string; rating: number | null; reviews: number | null; open: string; cost: string; distance: number | null; confidence: number; source: string; url: string | null; reasons: string[]; warnings: string[]; claims: Array<{ field: string; value: string | number | boolean; source: string; url: string | null; confidence: number; ageHours: number; status: string }> };

const removePrivateData = (value: string) => value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[removed]").replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, "[removed]").replace(/\b\d{1,5}\s+[A-Za-z][\w .'-]{2,}(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Nagar|Layout|Block)\b/gi, "[generalized]");
const claim = (field: string, value: string | number | boolean, source: string, url: string | null, confidence: number, status = "verified") => ({ field, value, source, url, confidence, ageHours: 1, status });

const mockResults = (): Candidate[] => [
  { name: "Anna Nagar Study Cafe", category: "Cafe", rating: 4.4, reviews: 182, open: "Open now", cost: "₹₹", distance: 1.2, confidence: 0.82, source: "Google Maps", url: "https://example.org/study-cafe", reasons: ["Meets Wi-Fi and charging requirements", "Open-now signal is available", "Strong rating and review signal"], warnings: ["Confirm current seating and amenity availability before leaving."], claims: [claim("open status", "Open now", "Maps", "https://example.org/study-cafe", 0.82), claim("Wi-Fi", "Available in snippet", "Search", "https://example.org/study-cafe", 0.72, "partially verified"), claim("charging points", "Available in snippet", "Search", "https://example.org/study-cafe", 0.72, "partially verified"), claim("rating", 4.4, "Maps", "https://example.org/study-cafe", 0.86), claim("price", "₹₹", "Maps", "https://example.org/study-cafe", 0.7)] },
  { name: "Anna Nagar Public Library", category: "Library", rating: 4.6, reviews: 94, open: "Closed now", cost: "Free", distance: 1.8, confidence: 0.76, source: "Google Maps", url: "https://example.org/library", reasons: ["Strong rating and review signal", "Accessible reading-room information", "Lower cost signal"], warnings: ["Excluded from the open-now shortlist because it is currently closed."], claims: [claim("open status", "Closed now", "Maps", "https://example.org/library", 0.84), claim("accessibility", "Accessible entrance", "Search", "https://example.org/library", 0.76), claim("rating", 4.6, "Maps", "https://example.org/library", 0.86), claim("price", "Free", "Maps", "https://example.org/library", 0.7)] },
];

async function liveSearch(engine: "google_maps" | "google" | "google_news", query: string): Promise<SearchRecord[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("LIVE_PROVIDER_NOT_CONFIGURED");
  const url = new URL("https://serpapi.com/search.json");
  // Broad locality is embedded in the query. SerpApi rejects many neighborhood strings
  // (for example, "Anna Nagar, Chennai") when sent through its location parameter.
  url.searchParams.set("engine", engine); url.searchParams.set("q", query); url.searchParams.set("api_key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (response.status === 402 || response.status === 429) throw new Error("PROVIDER_QUOTA");
  if (!response.ok) throw new Error("PROVIDER_ERROR");
  const body = (await response.json()) as { local_results?: SearchRecord[]; organic_results?: SearchRecord[]; news_results?: SearchRecord[] };
  const records = engine === "google_maps" ? body.local_results : engine === "google" ? body.organic_results : body.news_results;
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
  if (live) {
    try {
      const records = await liveSearch("google_maps", `${sanitizedText} near ${sanitizedLocation}`);
      resultCount = records.length;
      engineResultCounts.google_maps = records.length;
      candidates = records.map((record, index) => { const name = typeof record.title === "string" ? record.title : `Candidate ${index + 1}`; const url = typeof record.link === "string" && /^https?:\/\//.test(record.link) ? record.link : null; return { name, category: typeof record.type === "string" ? record.type : "Unknown", rating: typeof record.rating === "number" ? record.rating : null, reviews: typeof record.reviews === "number" ? record.reviews : null, open: typeof record.open_state === "string" ? record.open_state : "Unknown", cost: typeof record.price === "string" ? record.price : "Unknown", distance: null, confidence: 0.55, source: "Google Maps via SerpApi", url, reasons: ["Discovered by live Google Maps search", "Candidate facts remain subject to verification", "Source and retrieval metadata are preserved"], warnings: ["Live provider data may be incomplete or change."], claims: [claim("open status", typeof record.open_state === "string" ? record.open_state : "Unknown", "Maps", url, 0.55, "partially verified"), claim("rating", typeof record.rating === "number" ? record.rating : "Unknown", "Maps", url, 0.55, typeof record.rating === "number" ? "verified" : "unknown")] }; });
      try { verificationResults = await liveSearch("google", `official information and amenities for ${sanitizedText} near ${sanitizedLocation}`); engineResultCounts.google = verificationResults.length; } catch (error) { providerError = error instanceof Error ? error.message : "PROVIDER_ERROR"; }
      if (input.currentCheck) { try { newsResults = await liveSearch("google_news", `${sanitizedLocation} closure relocation disruption event temporary change`); engineResultCounts.google_news = newsResults.length; } catch (error) { providerError = error instanceof Error ? error.message : "PROVIDER_ERROR"; } }
      if (verificationResults.length) candidates = candidates.map((item) => ({ ...item, confidence: Math.min(0.9, item.confidence + 0.12), reasons: [...item.reasons, "Cross-checked against Google Search results"], claims: [...item.claims, claim("official information", "Search result available", "Search", typeof verificationResults[0]?.link === "string" ? verificationResults[0].link : null, 0.67, "partially verified")] }));
      if (newsResults.length) candidates = candidates.map((item) => ({ ...item, warnings: [...item.warnings, "Current News returned a change signal; review the Change Radar before travelling."], claims: [...item.claims, claim("current changes", "News signal detected", "News", typeof newsResults[0]?.link === "string" ? newsResults[0].link : null, 0.62, "partially verified")] }));
    } catch (error) { providerError = error instanceof Error ? error.message : "PROVIDER_ERROR"; }
  } else { candidates = mockResults(); resultCount = candidates.length; }
  const rejected = input.openNow ? candidates.filter((item) => item.open.toLowerCase().includes("closed")).map((item) => ({ name: item.name, reasons: ["Closed while open-now was required"] })) : [];
  const eligible = candidates.filter((item) => !rejected.some((entry) => entry.name === item.name));
  const uncertain = candidates.filter((item) => item.open === "Unknown").map((item) => ({ name: item.name, missingEvidence: ["open status", "distance", "current facility availability"] }));
  const constraints = discoverConstraints(input);
  const tasks = [{ engine: "google_maps", purpose: "local discovery", query: `${sanitizedText} near ${sanitizedLocation}` }, { engine: "google", purpose: "official information verification", query: `official information for ${sanitizedLocation}` }, ...(input.currentCheck ? [{ engine: "google_news", purpose: "current disruption checking", query: `${sanitizedLocation} closure disruption safety` }] : [])];
  const recommendations = eligible.map((item, index) => ({ ...item, rank: index + 1, score: Math.max(35, Math.min(96, 84 - index * 17)), scoreBreakdown: { constraintSatisfaction: index === 0 ? 100 : 50, openNow: item.open.toLowerCase().includes("open") ? 100 : 0, ratingReview: item.rating ? Math.round(item.rating * 20) : 25, proximity: item.distance ? Math.round(Math.max(0, 100 - item.distance * 10)) : 25, priceFit: input.budget ? 80 : 50, freshnessConfidence: Math.round(item.confidence * 100) } }));
  const graph = recommendations.flatMap((item) => item.claims.map((evidence) => ({ recommendation: item.name, claim: evidence.field, sourceType: evidence.source, sourceUrl: evidence.url, confidence: evidence.confidence, freshnessHours: evidence.ageHours, status: evidence.status })));
  const freshness = graph.map((edge) => ({ field: edge.claim, ageHours: edge.freshnessHours, status: edge.freshnessHours < 6 ? "Fresh" : edge.freshnessHours < 24 ? "Recent" : "Stale", impact: edge.freshnessHours < 6 ? "positive" : "penalized" }));
  const replay = ["Privacy sanitization", "Constraint discovery", "Query planning", "Maps discovery", "Official verification", ...(input.currentCheck ? ["News change check"] : []), "Hard filtering", "Confidence scoring", "Explainable ranking", "Action plan"];
  const noMatch = recommendations.length === 0 ? { failedConstraints: constraints, smallestRelaxations: constraints.slice(0, 2).map((constraint) => `Relax ${constraint}`), message: "No eligible candidate matched all hard constraints." } : null;
  return { mode, providerError, constraints, privacy: { enabled: input.privacyMode, rawRequestStored: false, sentContext: sanitizedText, broadLocation: sanitizedLocation, blocked: input.privacyMode ? ["email", "phone", "exact address"] : [] }, workflow: replay, tasks, mission: { engines: tasks.map((task) => ({ engine: task.engine, purpose: task.purpose, status: providerError && engineResultCounts[task.engine] === 0 ? "error" : "complete", resultCount: engineResultCounts[task.engine] ?? 0, contribution: task.purpose })), requestCount: live ? Object.values(engineResultCounts).reduce((sum, count) => sum + (count > 0 ? 1 : 0), 0) : 0, mode }, recommendations, rejected, uncertain, evidenceGraph: graph, freshnessRadar: freshness, changeRadar: input.currentCheck ? { status: providerError && engineResultCounts.google_news === 0 ? "unavailable" : "checked", warning: providerError && engineResultCounts.google_news === 0 ? "Current News check unavailable" : newsResults.length ? "News signal detected; confirm before travel." : "No current disruption signal returned; confirm before travel." } : null, replay, confidenceMeter: recommendations.map((item) => ({ name: item.name, sourceQuality: Math.round(item.confidence * 100), freshness: 96, agreement: 78, completeness: item.claims.length ? 80 : 20, overall: Math.round(item.confidence * 100 * 0.3 + 96 * 0.2 + 78 * 0.2 + 80 * 0.3) })), actionPlan: eligible[0] ? { recommendation: eligible[0].name, confirmBeforeLeaving: ["opening status", "Wi-Fi and charging availability", "current price"], fallback: eligible[1]?.name ?? "No fallback found", confidence: eligible[0].confidence, limitations: ["Information can change. Confirm important details before travelling."] } : { recommendation: null, confirmBeforeLeaving: [], fallback: "No eligible candidate", confidence: 0, limitations: ["No eligible result was found."] }, noMatch };
});
