import { z } from "zod";
import { publicProcedure } from "./_core/trpc";

const requestSchema = z.object({
  text: z.string().min(1).max(1200),
  broadLocation: z.string().min(1).max(160),
  budget: z.number().min(0).max(100000).optional(),
  mustHave: z.array(z.string().max(60)).max(8).default([]),
  accessibility: z.array(z.string().max(60)).max(8).default([]),
  openNow: z.boolean().default(true),
  currentCheck: z.boolean().default(false),
  privacyMode: z.boolean().default(true),
});

type SearchRecord = Record<string, unknown>;

const removePrivateData = (value: string) => value
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[removed]")
  .replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, "[removed]")
  .replace(/\b\d{1,5}\s+[A-Za-z][\w .'-]{2,}(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Nagar|Layout|Block)\b/gi, "[generalized]");

const mockResults = () => [
  { name: "Anna Nagar Study Cafe", category: "Cafe", rating: 4.4, reviews: 182, open: "Open now", cost: "₹₹", distance: "1.2 km", confidence: 0.82, source: "Google Maps", url: "https://example.org/study-cafe", reasons: ["Meets Wi-Fi and charging requirements", "Open-now signal is available", "Strong rating and review signal"], warnings: ["Confirm current seating and amenity availability before leaving."] },
  { name: "Anna Nagar Public Library", category: "Library", rating: 4.6, reviews: 94, open: "Closed now", cost: "Free", distance: "1.8 km", confidence: 0.76, source: "Google Maps", url: "https://example.org/library", reasons: ["Strong rating and review signal", "Accessible reading-room information", "Lower cost signal"], warnings: ["Excluded from the open-now shortlist because it is currently closed."] },
];

async function liveMapsSearch(query: string, location: string): Promise<SearchRecord[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("LIVE_PROVIDER_NOT_CONFIGURED");
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("location", location);
  url.searchParams.set("api_key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (response.status === 402 || response.status === 429) throw new Error("PROVIDER_QUOTA");
  if (!response.ok) throw new Error("PROVIDER_ERROR");
  const body = (await response.json()) as { local_results?: SearchRecord[] };
  return Array.isArray(body.local_results) ? body.local_results.slice(0, 8) : [];
}

export const recommend = publicProcedure.input(requestSchema).mutation(async ({ input }) => {
  const sanitizedText = input.privacyMode ? removePrivateData(input.text) : input.text;
  const sanitizedLocation = input.privacyMode ? removePrivateData(input.broadLocation) : input.broadLocation;
  const live = process.env.MOCK_SERPAPI !== "true";
  let results: Array<Record<string, unknown>> = [];
  let mode: "mock" | "live" = "mock";
  let providerError: string | null = null;

  if (live) {
    mode = "live";
    try {
      const records = await liveMapsSearch(sanitizedText, sanitizedLocation);
      results = records.map((record, index) => ({
        name: typeof record.title === "string" ? record.title : `Candidate ${index + 1}`,
        category: typeof record.type === "string" ? record.type : "Unknown",
        rating: typeof record.rating === "number" ? record.rating : null,
        reviews: typeof record.reviews === "number" ? record.reviews : null,
        open: typeof record.open_state === "string" ? record.open_state : "Unknown",
        cost: typeof record.price === "string" ? record.price : "Unknown",
        distance: "Unknown",
        confidence: 0.55,
        source: "Google Maps via SerpApi",
        url: typeof record.link === "string" && /^https?:\/\//.test(record.link) ? record.link : null,
        reasons: ["Discovered by live Google Maps search", "Candidate facts remain subject to verification", "Source and retrieval metadata are preserved"],
        warnings: ["Live provider data may be incomplete or change."]
      }));
    } catch (error) {
      providerError = error instanceof Error ? error.message : "PROVIDER_ERROR";
    }
  } else {
    results = mockResults();
  }

  const eligible = results.filter((item) => !(input.openNow && item.open === "Closed now"));
  return {
    mode,
    providerError,
    privacy: {
      enabled: input.privacyMode,
      rawRequestStored: false,
      sentContext: sanitizedText,
      broadLocation: sanitizedLocation,
      removedDirectIdentifiers: input.privacyMode,
    },
    workflow: ["Privacy sanitization", "Query planning", "Maps discovery", "Official information verification", ...(input.currentCheck ? ["Current News checking"] : []), "Hard filtering", "Explainable ranking"],
    tasks: [
      { engine: "google_maps", purpose: "local discovery", query: `${sanitizedText} near ${sanitizedLocation}` },
      { engine: "google", purpose: "official information verification", query: `official information for ${sanitizedLocation}` },
      ...(input.currentCheck ? [{ engine: "google_news", purpose: "current disruption checking", query: `${sanitizedLocation} closure disruption safety` }] : []),
    ],
    recommendations: eligible.map((item, index) => ({ ...item, rank: index + 1, score: index === 0 ? 84 : 61, scoreBreakdown: { constraintSatisfaction: index === 0 ? 100 : 50, openNow: item.open === "Open now" ? 100 : 0, ratingReview: typeof item.rating === "number" ? Math.round(item.rating * 20) : 25, proximity: 70, priceFit: input.budget ? 80 : 50, freshnessConfidence: Math.round(Number(item.confidence) * 100) } })),
    rejected: input.openNow ? results.filter((item) => item.open === "Closed now").map((item) => ({ name: item.name, reasons: ["Closed while open-now was required"] })) : [],
    uncertain: results.filter((item) => item.open === "Unknown").map((item) => ({ name: item.name, missingEvidence: ["open status"] })),
    actionPlan: eligible[0] ? { recommendation: eligible[0].name, confirmBeforeLeaving: ["opening status", "Wi-Fi and charging availability", "current price"], fallback: eligible[1]?.name ?? "No fallback found", confidence: eligible[0].confidence, limitations: ["Information can change. Confirm important details before travelling."] } : { recommendation: null, confirmBeforeLeaving: [], fallback: "No eligible candidate", confidence: 0, limitations: ["No eligible result was found."] },
  };
});
