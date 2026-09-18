import { describe, expect, it } from "vitest";

describe("live SerpApi configuration", () => {
  it("returns a successful sanitized response using the server-only key", async () => {
    const apiKey = process.env.SERPAPI_KEY;
    expect(apiKey).toBeTruthy();

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("q", "study places near Anna Nagar Chennai");
    url.searchParams.set("api_key", apiKey as string);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = (await response.json()) as { error?: string; local_results?: unknown[] };

    expect(response.ok, body.error ?? "SerpApi live request failed").toBe(true);
    expect(body).not.toHaveProperty("api_key");
    console.log({ mode: "live", engine: "google_maps", resultCount: Array.isArray(body.local_results) ? body.local_results.length : 0 });
  }, 15000);
});
