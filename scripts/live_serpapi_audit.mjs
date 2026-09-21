import process from "node:process";

const key = process.env.SERPAPI_KEY;
const timeoutMs = Math.max(2000, Math.min(10000, Number(process.env.SERPAPI_TIMEOUT_SECONDS ?? 5) * 1000));
const outcomes = [];

async function call(engine, params) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", engine);
  url.searchParams.set("api_key", key ?? "");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await response.json();
    const records = engine === "google_maps"
      ? body.local_results
      : engine === "google"
        ? body.organic_results
        : engine === "google_news"
          ? body.news_results
          : body.reviews;
    const result = {
      engine,
      httpStatus: response.status,
      ok: response.ok,
      latencyMs: Date.now() - started,
      resultCount: Array.isArray(records) ? records.length : 0,
      hasError: typeof body.error === "string",
      error: typeof body.error === "string" ? body.error.slice(0, 180) : null,
      hasExpectedArray: Array.isArray(records),
      firstRecordFields: Array.isArray(records) && records[0] ? Object.keys(records[0]).slice(0, 12) : [],
    };
    outcomes.push(result);
    return { body, records: Array.isArray(records) ? records : [] };
  } catch (error) {
    const result = {
      engine,
      httpStatus: null,
      ok: false,
      latencyMs: Date.now() - started,
      resultCount: 0,
      hasError: true,
      error: error instanceof Error ? error.message.slice(0, 180) : "unknown error",
      hasExpectedArray: false,
      firstRecordFields: [],
    };
    outcomes.push(result);
    return { body: {}, records: [] };
  }
}

if (!key) {
  console.log(JSON.stringify({ credentialConfigured: false, outcomes: [], verdict: "NOT_WORKING: SERPAPI_KEY is not available to the server process" }, null, 2));
  process.exit(2);
}

const maps = await call("google_maps", { q: "study places near Anna Nagar Chennai" });
await call("google", { q: "official information study places near Anna Nagar Chennai" });
await call("google_news", { q: "Anna Nagar Chennai closure disruption" });
const placeId = maps.records.find((record) => typeof record.place_id === "string")?.place_id;
if (placeId) await call("google_maps_reviews", { place_id: placeId });
else outcomes.push({ engine: "google_maps_reviews", skipped: true, reason: "No place_id returned by Google Maps" });

const failed = outcomes.filter((item) => item.ok === false && item.skipped !== true);
const missingArrays = outcomes.filter((item) => item.skipped !== true && item.hasExpectedArray === false);
console.log(JSON.stringify({
  credentialConfigured: true,
  timeoutMs,
  outcomes,
  verdict: failed.length === 0 && missingArrays.length === 0 ? "WORKING" : "DEGRADED",
}, null, 2));
process.exit(failed.length === 0 && missingArrays.length === 0 ? 0 : 1);
