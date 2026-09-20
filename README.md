# NammaNav AI

## Privacy-First Local Decision Intelligence Powered by SerpApi Ground-Truth Evidence

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![Next.js](https://img.shields.io/badge/React%2FVite-Web-61DAFB?logo=react&logoColor=111827)](https://react.dev/) [![Streamlit](https://img.shields.io/badge/Streamlit-Python%20companion-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io/) [![SerpApi](https://img.shields.io/badge/SerpApi-Live%20evidence-12B8A6)](https://serpapi.com/)

> **Don't just search. Decide.** Then challenge the decision before you act.

NammaNav AI is a local decision-readiness agent. It does not simply return a list of places or generate an unsupported answer. It transforms a natural-language goal into a privacy-aware decision contract, discovers candidates through live SerpApi engines, verifies important claims, searches for evidence that could invalidate its own recommendation, preserves conflicts and uncertainty, and produces an evidence-backed action plan.

**Visual runtime status:** `SerpApi Status: Live | Latency Tracking | Zero-Dependency Mock Fallback`

---

## The Core Insight — Idea Strength and Usefulness

Traditional local search optimizes for retrieval: it returns blue links, map cards, ratings, or snippets and leaves the user to decide whether the information is current, relevant, or contradictory. A general-purpose language model can summarize the request, but without grounded retrieval it may hallucinate opening hours, amenities, prices, or branch identity.

NammaNav AI treats a local request as a decision under uncertainty. A request such as “Find me a quiet place to study near Anna Nagar, Chennai, open now, under ₹300, with Wi-Fi and charging points” becomes a structured contract containing hard requirements, soft preferences, risk if wrong, required proof, and an acceptable fallback. The system then turns provider evidence into claim-level records, applies deterministic risk-aware scoring, and explains what the user should confirm before acting.

The result is not “the best place.” It is a transparent answer to a more useful question: **is this recommendation defensible enough for this specific goal right now?**

---

## Architecture and SerpApi Pipeline

```text
User Query
    │
    ▼
Constraint Parser + Decision Contract
    │  goal, hard requirements, risk, required proof, fallback
    ▼
Privacy Transformation
    │  broad location; PII and exact addresses blocked
    ▼
SerpApi Multi-Engine Evidence Pipeline
    ├── google_maps       → DISCOVER local candidates, ratings, reviews, open state, thumbnails
    ├── google            → VERIFY official information and amenities
    ├── google_maps_reviews → ATTACK the recommendation with recent review evidence
    └── google_news       → DETECT current closures, disruptions, events, or safety changes
    │
    ▼
Claim Inspector + Structured Fact Extractor
    │  value, source, URL, engine, timestamp, freshness, polarity, confidence
    ▼
Audit Strictness Re-Ranker
    │  relevance − (unverified claims × strictness multiplier)
    ▼
Conflict Resolver + Temporal Truth Engine
    │  CURRENT / AGING / STALE / CONFLICTING; no silent source selection
    ▼
Decision Dossier + Action Plan
    │  evidence graph, stress tests, uncertainty, fallback, limitations
    ▼
Explainable Final Decision
```

SerpApi is materially essential rather than cosmetic. Google Maps supplies local discovery and structured operational facts. Google Search supplies verification leads. Maps Reviews provides targeted challenge evidence. Google News is used only when the user asks for current disruption checking. Every provider call is tracked with engine, purpose, query, status, latency, result count, errors, and workflow allowance. The server never exposes `SERPAPI_KEY` to the browser.

---

## Key Features and Innovations

| Capability | What it does | Why it matters |
|---|---|---|
| **Natural-Language Goal Engine** | Converts a conversational request into an explicit decision contract. | Captures intent, hard requirements, risk, proof, and fallback instead of guessing. |
| **Interactive Constraint Discovery** | Extracts requirements into editable chips. | Lets the user correct the agent before evidence collection. |
| **Multi-Engine SerpApi Evidence Pipeline** | Uses Maps, Search, Reviews, and News for distinct purposes. | Makes live local evidence part of the decision, not a decorative integration. |
| **Claim-Level Evidence Inspector** | Expands each recommendation claim into value, status, source, engine, URL, timestamp, freshness, confidence, and polarity. | Makes every important assertion inspectable. |
| **Prove Me Wrong** | Runs targeted searches for closures, conflicting hours, price mismatch, missing amenities, complaints, and disruptions. | The system actively searches for reasons its own answer could be wrong. |
| **Audit Strictness Engine** | Low `0.0`, Medium `0.5`, or High `1.0` penalty for unverified claims. | Lets users choose how conservative the ranking should be. |
| **Temporal Truth Engine** | Classifies evidence as CURRENT, AGING, STALE, or CONFLICTING. | Prevents old information from masquerading as current truth. |
| **Decision Attack Surface** | Ranks closure, price, hours, feature, freshness, disagreement, suitability, and disruption risks. | Prioritizes what should be checked before acting. |
| **Decision Stress Test** | Compares the recommendation under budget, distance, amenity, accessibility, and opening variations. | Makes trade-offs visible rather than hiding them. |
| **Local Privacy Transformation** | Generalizes locations and blocks email, phone, exact-address, and secret leakage. | Minimizes unnecessary data sent to providers and exports. |
| **Decision Dossier** | Exports JSON or Markdown containing the contract, privacy transformation, tasks, evidence, conflicts, scores, sources, uncertainty, and limitations. | Produces a shareable, auditable artifact for a decision. |

---

## Quickstart and Local Execution

### Requirements

- Node.js 22 or newer
- pnpm
- Optional Python 3.11 for the Streamlit companion interface
- A SerpApi key for live mode; never commit it to source control

### Web application

```bash
git clone <your-repository-url>
cd nammanav-site
pnpm install

# Live mode: configure the key in the server environment only
export SERPAPI_KEY="your-server-side-key"
export MOCK_SERPAPI="false"

pnpm check
pnpm test
pnpm dev
```

The live application uses the server-side SerpApi secret. Do not put the key in a `VITE_*` variable, browser code, query string, README, screenshot, or exported dossier.

### Zero-dependency mock mode

Mock mode is designed for demos, tests, and provider outages. It uses deterministic local fixtures and makes no external SerpApi calls.

```bash
cd nammanav-site
pnpm install
export MOCK_SERPAPI="true"
unset SERPAPI_KEY
pnpm check
pnpm test
pnpm dev
```

The UI labels mock mode as **SerpApi Status: Mock Fallback** and shows an empty raw provider payload rather than inventing live request activity.

### Python / Streamlit companion

The original Python foundation remains available in the sibling `nammanav/` project:

```bash
cd ../nammanav
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
streamlit run frontend/app.py
```

---

## Hackathon Live Demo — Under Two Minutes

1. **State the goal.** Use the default Anna Nagar study request. Show the Decision Contract and the `Goal → Privacy → Discover → Verify → Challenge → Decide` pipeline.
2. **Start the investigation.** Point out the server-side live status badge, latency, provider request count, and structured Maps facts such as rating, review count, open state, and thumbnail availability.
3. **Inspect evidence.** Expand a claim in the Evidence Inspector. Show the source type, SerpApi engine, source URL, retrieved time, freshness, confidence, and whether it supports or challenges the decision.
4. **Attack the answer.** Click **Prove Me Wrong**. Show challenge telemetry, conflict handling, Temporal Truth, the Decision Attack Surface, and initial-versus-final score changes. If no contradiction is found, show the explicit “No contradiction found in the searched evidence” message.
5. **Adjust and export.** Move Audit Strictness from Medium to High, rerun, open the Raw SerpApi Payload section, review the Stress Test Decision panel, and export the Decision Dossier.

---

## Judging Criteria Mapping

| Official criterion | NammaNav AI evidence |
|---|---|
| **Idea Strength** | Reframes local search as a decision-readiness problem with explicit proof and risk. |
| **Originality** | “Prove Me Wrong” and the Decision Attack Surface search for evidence against the system’s own answer. |
| **Technical Complexity** | Multi-engine provider orchestration, privacy transformation, claim graph, temporal classification, conflict preservation, strictness-aware reranking, bounded telemetry, exports, and resilient mock mode. |
| **Usefulness** | Helps users act on time-sensitive local decisions while showing what to confirm and what could change the answer. |
| **Meaningful SerpApi Usage** | Maps for discovery and structured local facts, Search for verification, Reviews for challenge evidence, and News for current changes—each with visible purpose and telemetry. |

---

## Safety and Limitations

NammaNav AI does not guarantee privacy, accuracy, safety, availability, or current information. Provider responses can be incomplete, contradictory, malformed, stale, or unavailable. Distances and facilities may require confirmation. The system preserves uncertainty rather than converting it into a positive claim. Confirm important details directly before travelling or relying on a recommendation.

The mock provider is intentionally deterministic and is not evidence of live SerpApi activity. Live mode is bounded by workflow request allowances and can fail due to timeouts, quota limits, provider errors, or empty results.

---

## License

This project is released under the MIT License. See [`LICENSE`](LICENSE).

## Third-Party Attribution

NammaNav AI uses and acknowledges FastAPI, Streamlit, React, Vite, TypeScript, Node.js, Pydantic, SQLite, pytest, and SerpApi. Their respective names and marks remain the property of their owners.
