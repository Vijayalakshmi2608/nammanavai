# NammaNav AI: Render Deployment Guide and Project Summary

This guide deploys the current NammaNav AI full-stack application as one Render **Web Service**. The application is a React/Vite frontend served by an Express/tRPC Node.js backend. SerpApi is called only from the server.

## Part 1: What the project is

NammaNav AI is a privacy-first, evidence-based local decision-readiness agent. It does not simply return search results. It transforms a natural-language request into a decision contract, retrieves live local evidence, verifies important claims, searches for counter-evidence, applies risk-aware ranking, and explains whether the recommendation is ready to act on.

### Product promise

> Don’t just search. Decide. Then challenge the decision.

### End-to-end workflow

1. **Decision Contract** — captures the goal, hard requirements, soft preferences, risk if wrong, required proof, and acceptable fallback.
2. **Privacy Transformation** — removes email addresses, phone numbers, and exact street-address patterns before provider queries.
3. **Constraint Discovery** — detects requirements such as budget, distance, open-now, Wi-Fi, charging, accessibility, quiet environment, and nearby food.
4. **Search Planning** — assigns each evidence task to the appropriate SerpApi engine.
5. **Google Maps Discovery** — finds local candidates and structured facts such as ratings, review counts, open state, links, and thumbnails.
6. **Google Search Verification** — cross-checks official information, amenities, and important claims.
7. **Prove Me Wrong** — searches for closures, conflicting hours, complaints, price mismatch, missing features, wrong branches, crowding/noise, and outdated information.
8. **Maps Reviews Challenge** — checks candidate-specific review evidence when a place ID is available.
9. **Google News Change Radar** — checks current closures, relocations, disruptions, events, or safety changes when enabled.
10. **Conflict and Freshness Analysis** — preserves conflicting, stale, aging, unknown, supporting, and challenging evidence rather than silently resolving it.
11. **Strictness-Aware Ranking** — scores candidates using the auditable formula:

   ```text
   Score = (Base Relevance × 0.6)
         + (Verified Claims × 5)
         − (Unverified Claims × 12 × Strictness)
         − (Source Conflicts × 25 × Strictness)
   ```

12. **Decision Mutation Log** — shows initial score, evidence discovered, score impact, challenge result, final score, and decision impact.
13. **Final Verdict** — returns Proceed, Proceed with caution, Verify before acting, Avoid for this goal, or No safe match found.
14. **Decision Dossier** — exports a privacy-safe JSON or Markdown evidence receipt.

## Part 2: Technology stack

- React 19 + Vite frontend
- TypeScript
- Node.js 22
- Express server
- tRPC API under `/api/trpc`
- SerpApi REST integration
- Vitest regression and integration tests
- Drizzle/MySQL-compatible project infrastructure from the WebDev template
- Local browser Decision History using privacy-safe summaries
- Render Web Service for production hosting

## Part 3: Before deploying

### 1. Confirm the GitHub repository

Use the GitHub repository containing the latest NammaNav source. The repository should include:

- `package.json`
- `pnpm-lock.yaml`
- `client/`
- `server/`
- `shared/`
- `drizzle/`
- `vite.config.ts`
- `tsconfig.json`

### 2. Test locally

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

For live mode, configure the key only in your local shell or `.env` file that is excluded from Git:

```bash
export SERPAPI_KEY="your-serpapi-key"
export MOCK_SERPAPI="false"
export SERPAPI_TIMEOUT_SECONDS="12"
export SERPAPI_MAX_REQUESTS_PER_WORKFLOW="5"
```

Never commit `.env`, API keys, or secrets.

### 3. Push the latest code to GitHub

If you made local changes after the last GitHub push:

```bash
git status
git add package.json server/_core/index.ts README.md docs/
git commit -m "Prepare NammaNav AI for Render deployment"
git push origin main
```

If your GitHub remote has a different name, replace `origin` with that remote name.

## Part 4: Create the Render service

Render’s official Node/Express flow is **New → Web Service**, connect the GitHub repository, then provide build and start commands.

1. Open the [Render Dashboard](https://dashboard.render.com/).
2. Click **New**.
3. Select **Web Service**.
4. Connect GitHub if prompted.
5. Select the NammaNav repository.
6. Select the `main` branch.
7. Use these settings:

| Render setting | Value |
|---|---|
| Name | `nammanav-ai` or another unique name |
| Region | Choose the region closest to your audience |
| Runtime | `Node` |
| Branch | `main` |
| Root Directory | Leave blank because `package.json` is at repository root |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start Command | `pnpm start` |
| Health Check Path | `/health` |
| Auto-Deploy | `Yes` for automatic deploys after GitHub pushes |
| Instance type | Choose the plan appropriate for your traffic and hackathon demo |

The server reads Render’s `PORT` environment variable and binds the application to that port. Do not hard-code a public port in Render settings.

## Part 5: Add Render environment variables

In the Render service, open **Environment → Environment Variables → Add Environment Variable**.

Add the following values:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production static-file serving |
| `SERPAPI_KEY` | Your real SerpApi key | Secret; server-side only |
| `MOCK_SERPAPI` | `false` | Required for real provider calls |
| `SERPAPI_TIMEOUT_SECONDS` | `12` | Bounded provider timeout |
| `SERPAPI_MAX_REQUESTS_PER_WORKFLOW` | `5` | Bounded workflow request allowance |

Do **not** add `SERPAPI_KEY` with a `VITE_` prefix. Do **not** add it to client-side code. Do **not** paste it into GitHub, README files, screenshots, browser URLs, or exported dossiers.

After saving variables, choose **Save, rebuild, and deploy**.

## Part 6: Deploy and verify

1. Click **Create Web Service**.
2. Open the **Logs** tab.
3. Wait for the build to complete.
4. Confirm the start log reports the Node server running.
5. Open the generated `onrender.com` URL.
6. Verify the initial page loads and shows `SerpApi Status: Not checked` before an investigation.
7. Run the default Anna Nagar study request.
8. Confirm the status changes to a live provider status after the request.
9. Open `/health` directly. It should return JSON similar to:

   ```json
   {"status":"ok","service":"nammanav-site"}
   ```

10. Confirm the result contains:
    - live provider telemetry
    - request count and latency
    - Maps candidates
    - Search verification claims
    - challenge evidence
    - freshness and confidence data
    - final ranking and verdict
    - Decision Mutation Log
    - source links

## Part 7: Render troubleshooting

### Build fails because `pnpm` is unavailable

Use the Render build command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm build
```

The repository’s `packageManager` field and Node engine range pin the intended toolchain.

### Render uses the wrong Node version

The project declares:

```json
"engines": { "node": ">=22.0.0 <23.0.0" }
```

You can also set `NODE_VERSION=22.22.0` in Render Environment settings if you want an exact runtime version.

### Service starts but page is unavailable

Check:

- Start command is exactly `pnpm start`.
- `NODE_ENV=production` is set.
- The server uses Render’s `PORT`; it must not be replaced with `3000`.
- Logs show the server successfully started.
- `/health` returns HTTP 200.

### Provider calls fail

Check:

- `SERPAPI_KEY` exists in Render Environment settings.
- The key was not accidentally added as a `VITE_` variable.
- `MOCK_SERPAPI=false`.
- SerpApi quota is available.
- Provider telemetry identifies HTTP status, timeout, quota, and error state.

### The site shows mock mode

Confirm the Render variable is exactly:

```text
MOCK_SERPAPI=false
```

Environment values are strings; do not use JSON booleans.

### Render health checks fail

Use `/health` as the HTTP health-check path. It returns a fast HTTP 200 response without making a SerpApi call.

## Part 8: Production security checklist

- [ ] `SERPAPI_KEY` exists only in Render server environment variables.
- [ ] No `SERPAPI_KEY` or 64-character credential appears in Git history or client bundle.
- [ ] No `VITE_SERPAPI` variable exists.
- [ ] `MOCK_SERPAPI=false` in production.
- [ ] Provider request count is bounded.
- [ ] Provider timeout is bounded.
- [ ] Raw private input is not stored in Decision History or dossier exports.
- [ ] Source URLs are preserved for inspection.
- [ ] Live provider failures are visible and do not fabricate evidence.
- [ ] Users are warned that information can change and must be confirmed.
- [ ] `/health` is configured in Render.
- [ ] Auto-deploy is enabled only for the intended branch.

## Part 9: Final project summary for judges

NammaNav AI is a local decision intelligence product rather than a normal local search interface. Its differentiator is that it investigates whether a recommendation is trustworthy enough to act on.

The strongest demo story is:

```text
Natural-language goal
  → Privacy-safe decision contract
  → SerpApi discovery
  → Verification
  → Prove Me Wrong challenge
  → Conflict and freshness analysis
  → Strictness-aware score mutation
  → Evidence-backed final verdict
```

The product demonstrates meaningful SerpApi usage through four distinct engines:

- **Google Maps:** local discovery and structured candidate facts.
- **Google Search:** verification and counter-evidence discovery.
- **Google Maps Reviews:** candidate-specific challenge evidence.
- **Google News:** current disruption and change detection.

The product’s judge-facing proof surfaces are:

- Decision Contract
- Privacy Preview
- SerpApi Mission Control
- Claim-level Evidence Inspector
- Evidence Matrix and Evidence Graph
- Freshness Radar and Temporal Truth
- Decision Attack Surface
- Prove Me Wrong
- Decision Mutation Log
- No-Match Intelligence
- Decision Stress Test
- Decision Dossier / Evidence Receipt
- Trust explanation and uncertainty panel

The project is useful because it makes local choices explainable, risk-aware, and auditable. It is original because it searches for reasons its own recommendation could be wrong. It is technically strong because provider calls, evidence claims, scoring, conflicts, freshness, telemetry, privacy transformations, and exports are connected in one decision pipeline.

NammaNav AI does not guarantee privacy, accuracy, safety, availability, or current information. Users should confirm important details directly before travelling or relying on a recommendation.
