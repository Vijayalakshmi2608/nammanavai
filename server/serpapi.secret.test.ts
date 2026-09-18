import { describe, expect, it } from "vitest";

describe("server-only SerpApi secret", () => {
  it("can authenticate to the lightweight SerpApi search endpoint without exposing the key", async () => {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return;

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("q", "study places near Anna Nagar Chennai");
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = (await response.json()) as { error?: string; search_metadata?: unknown };

    expect(response.ok, body.error ?? "SerpApi request failed").toBe(true);
    expect(body).not.toHaveProperty("api_key");
  }, 12000);
});
