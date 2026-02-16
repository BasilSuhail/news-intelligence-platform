# Narrative Threading: Tracking Developing Stories

**Document:** Technical specification for Narrative Threading (Phase 5)
**Status:** Implemented (2026-02-15)
**Philosophy:** News stories develop over days and weeks. A single cluster snapshot doesn't tell the full story. Narrative threading connects the dots.

---

## Overview

Links clusters across dates by entity overlap and keyword similarity. Tracks how stories evolve over time, detecting escalation or de-escalation patterns.

### Example

```
Day 1: "US considering new chip export controls"
Day 3: "NVIDIA warns of revenue impact from export restrictions"
Day 5: "China retaliates with rare earth export limits"
Day 7: "Semiconductor stocks drop 8% amid trade tensions"

→ Thread: "Developing: Semiconductor, Export, Controls"
→ Duration: 7 days
→ Escalation: Rising
→ Entities: US, NVIDIA, China
→ Sentiment Arc: [+5, -12, -28, -35]
```

---

## Architecture

```
Today's Clusters ──┐
                    ├── Compare by entity overlap + keyword match ──→ NarrativeThread[]
Last 7 Days     ──┘
Clusters
(from SQLite)

Matching Rules:
- 2+ shared entities → link
- OR 3+ shared keywords → link
- Combined score picks best match
- Extends existing threads if found
```

---

## Files

| File | Purpose |
|------|---------|
| `server/intelligence/clustering/narrative.ts` | Thread detection and linking engine |
| `client/src/components/intelligence/NarrativeTimeline.tsx` | Dashboard component showing developing stories |

---

## Backend Module (`narrative.ts`)

### Thread Building Algorithm

1. Get today's clusters from pipeline output
2. Get clusters from last 7 days via SQLite
3. For each today's cluster:
   - Extract entities (people, orgs, places) from all articles
   - Extract keywords
   - Compare against each historical cluster:
     - **Entity overlap score:** count of shared entity names × 3
     - **Keyword overlap score:** count of shared keywords × 2
     - **Category match bonus:** +1 if any category matches
   - If best match has ≥2 entity overlaps OR ≥3 keyword overlaps → link
4. Either extend existing thread or create new one
5. Save all threads to SQLite

### Escalation Detection

Analyzes the sentiment arc to determine if a story is escalating:

| Pattern | Interpretation |
|---------|---------------|
| Sentiment dropping by >10 | `rising` (tension increasing) |
| Sentiment rising by >10 | `declining` (tension easing) |
| Within ±10 range | `stable` |

### Pipeline Integration

Added as step 4d in `server/intelligence/core/pipeline.ts`:
```typescript
// 4d. Narrative Threading (Phase 5)
try {
    narrativeEngine.buildThreads(clusters, date);
} catch (err: any) {
    console.error('[Pipeline] Narrative threading failed (non-fatal):', err.message);
}
```

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS narrative_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  cluster_ids TEXT NOT NULL,       -- JSON array of cluster IDs
  sentiment_arc TEXT NOT NULL,     -- JSON array of sentiment numbers
  entities TEXT NOT NULL,          -- JSON array of entity names
  escalation TEXT NOT NULL,        -- 'rising' | 'stable' | 'declining'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_thread_lastseen ON narrative_threads(last_seen);
```

---

## API Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intelligence/narratives?days=14` | GET | Active narrative threads from last N days |

---

## Frontend Component (`NarrativeTimeline.tsx`)

### Layout

- Header with "Developing Stories" title and thread count badge
- Card per thread showing:
  - Title (e.g., "Developing: Semiconductor, Export, Controls")
  - Escalation indicator (red arrow up = escalating, green arrow down = de-escalating)
  - Duration and date range
  - Mini sentiment arc visualization (tiny bar chart)
  - Entity pills (up to 6 shown, +N more indicator)

### Empty State

Shows informative message: "No multi-day narrative threads detected yet."

---

## Data Model (`NarrativeThread` in types.ts)

```typescript
interface NarrativeThread {
  id: string;
  title: string;                     // "Developing: Semiconductor Trade Restrictions"
  firstSeen: string;                 // Date story first appeared
  lastSeen: string;                  // Most recent cluster date
  durationDays: number;
  clusterIds: string[];              // Linked cluster IDs
  sentimentArc: number[];            // Sentiment values over time
  entities: string[];                // All entities involved
  escalation: 'rising' | 'stable' | 'declining';
}
```

---

## Patterns Used

- **Singleton export:** `export const narrativeEngine = new NarrativeEngine()`
- **Logging prefix:** `[Narrative]`
- **Non-fatal in pipeline:** Wrapped in try/catch
- **Set iteration workaround:** `Array.from(set)` to avoid TS2802
