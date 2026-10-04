# NammaNav AI Decision Dossier Template

Use this structure for a shareable evidence receipt. Replace every placeholder with returned evidence; never invent a source snippet, confidence value, URL, or live metric.

## Goal
- Sanitized goal: `<privacy-safe goal>`
- Broad location: `<neighborhood/city only>`
- Risk if wrong: `<risk>`
- Required proof: `<proof>`
- Acceptable fallback: `<fallback>`

## Privacy Sanitation Log
- Raw request stored: `false`
- Sent context: `<sanitized context>`
- Generalized location: `<broad location>`
- Blocked fields: `email`, `phone`, `exact address`

## SerpApi Search Tasks
| Engine | Purpose | Status | Latency | Results | HTTP status |
|---|---|---:|---:|---:|---:|
| Google Maps | Discovery | `<status>` | `<ms>` | `<count>` | `<status>` |
| Google Search | Verification / challenge | `<status>` | `<ms>` | `<count>` | `<status>` |
| Maps Reviews | Counter-evidence | `<status>` | `<ms>` | `<count>` | `<status>` |
| Google News | Current disruption check | `<status>` | `<ms>` | `<count>` | `<status>` |

## Candidates and Ranking
For each candidate include initial score, verified claims, unverified claims, conflicts, challenge penalty, final score, verdict, and fallback.

## Verified Claims
| Candidate | Claim | Value | Source | Engine | URL | Retrieved | Freshness | Confidence | Polarity | Score impact |
|---|---|---|---|---|---|---|---:|---:|---|---:|

## Risk Warnings and Conflicts
- Closure risk: `<level and reason>`
- Price risk: `<level and reason>`
- Freshness risk: `<level and reason>`
- Source disagreement: `<level and reason>`
- Missing-feature risk: `<level and reason>`
- Disruption risk: `<level and reason>`
- Crowding/noise risk: `<level and reason>`
- Outdated-info risk: `<level and reason>`

## Decision Audit Trail
1. Decision Contract
2. Privacy sanitization
3. Search plan
4. SerpApi discovery
5. Verification
6. Prove Me Wrong challenge
7. Conflict and freshness analysis
8. Strictness-aware reranking
9. Final verdict and fallback

## Limitations
Information can change, provider responses may be incomplete or contradictory, and important hours, prices, amenities, distances, and safety details must be confirmed directly.
