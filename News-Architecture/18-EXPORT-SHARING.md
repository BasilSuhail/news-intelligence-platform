# Export & Sharing: PDF Briefings + Email Digest

**Document:** Technical specification for Export & Sharing (Phase 6)
**Status:** Implemented (2026-02-15)
**Philosophy:** Intelligence is only valuable if it reaches the right people at the right time.

---

## Overview

Two export mechanisms:

1. **PDF Briefing:** One-click export of the daily briefing as a printable HTML page (browser Print → Save as PDF)
2. **Email Digest:** Send briefings via email with configurable alert thresholds (GPR > 60, Impact > 80)

Both use the same underlying briefing data from the intelligence pipeline.

---

## Files

| File | Purpose |
|------|---------|
| `server/intelligence/export/pdf-briefing.ts` | Generates structured HTML for print/PDF + plain text for email |
| `server/intelligence/export/email-digest.ts` | Email sending via Resend with threshold-based alerts |
| `client/src/components/intelligence/ExportBriefing.tsx` | PDF + Email buttons on the dashboard |

---

## PDF Briefing (`pdf-briefing.ts`)

### Approach

Instead of server-side PDF generation (which requires heavy libraries like `pdfkit` or `puppeteer`), we generate clean, print-optimized HTML. The user opens it in a new tab and uses the browser's built-in Print → Save as PDF.

**Why this approach:**
- Zero additional dependencies
- Works on all browsers
- Clean, professional output
- `@media print` CSS hides unnecessary elements

### HTML Structure

1. **Header:** "Market Intelligence Briefing" + date
2. **Metrics row:** GPR Index | Market Sentiment | Topics Identified
3. **Executive Summary:** Full Gemini-generated text
4. **Top Topics:** Up to 5 clusters with sentiment badges, article counts, impact scores
5. **Footer:** Disclaimer

### Plain Text Generation

Also generates a plain-text version (`generateBriefingText()`) used as the email fallback body.

---

## Email Digest (`email-digest.ts`)

### Prerequisites

- `RESEND_API_KEY` environment variable must be set
- Resend npm package already installed in the project

### Threshold-Based Alerts

The email service checks thresholds before sending:

| Threshold | Default | Meaning |
|-----------|---------|---------|
| `gprThreshold` | 60 | Send if GPR Index ≥ this value |
| `impactThreshold` | 80 | Send if any topic's impact ≥ this value |
| `alwaysSend` | false | Override: send regardless of thresholds |

If neither threshold is met and `alwaysSend` is false, the email is **not sent** (saves API credits).

### Email Format

- **Subject:** `Intelligence Briefing: 2026-02-15 [GPR 72, High Impact]`
- **HTML body:** Professional email layout with:
  - Alert banner (amber) if thresholds exceeded
  - Key metrics (GPR + Sentiment)
  - Executive summary
  - Topics table (topic name, sentiment, articles, impact)
  - Disclaimer footer
- **Text fallback:** Plain text version for email clients that don't render HTML

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intelligence/export/pdf?date=YYYY-MM-DD` | GET | Returns printable HTML briefing |
| `/api/intelligence/export/email` | POST | Sends email digest |

### POST /api/intelligence/export/email

**Body:**
```json
{
  "email": "analyst@company.com",
  "date": "2026-02-15",
  "gprThreshold": 60,
  "impactThreshold": 80,
  "alwaysSend": true
}
```

**Response:**
```json
{
  "sent": true,
  "reason": "Email sent"
}
```

Or if thresholds not met:
```json
{
  "sent": false,
  "reason": "Thresholds not met (GPR: 42/60, max impact: 65/80)"
}
```

---

## Frontend Component (`ExportBriefing.tsx`)

### Layout

Two small buttons next to the "Executive Briefing" header:

1. **PDF button:** Opens `/api/intelligence/export/pdf` in a new tab
2. **Email button:** Toggles a dropdown with email input field + send button

### Email Flow

1. User clicks "Email" button → dropdown appears
2. Types email address → clicks "Send" (or presses Enter)
3. Sends POST to `/api/intelligence/export/email` with `alwaysSend: true`
4. Shows success (green check) or error (red X) inline

---

## Patterns Used

- **Dynamic imports in routes:** `await import("./intelligence/export/pdf-briefing")` to avoid loading at startup
- **Resend integration:** Uses the same `resend` package already configured for the contact form
- **No new dependencies:** Everything built with existing packages
- **Threshold gating:** Smart defaults prevent unnecessary email sends
